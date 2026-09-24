'use client'

import { useEffect, useRef, useState } from 'react'
import { Archive, UploadCloud, AlertCircle, File as FileIcon, Trash2 } from 'lucide-react'
import { MAX_RAW_FILE_BYTES } from '@/lib/raw-files'
import { invalidateStorageUsage } from '@/lib/useStorageUsage'
import { useConfirm, ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface RawFootageArchiveProps {
  projectId: string
  token: string | null
}

interface RawFile {
  id: string
  file_name: string
  file_size_bytes: number | null
  content_type: string | null
  created_at: string
  uploaded_by: string
  profiles?: { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null
}

type UploadState = 'idle' | 'uploading' | 'error'

interface UploadSession {
  uploadToken: string
  cancelled: boolean
  xhrs: Set<XMLHttpRequest>
}

const PART_CONCURRENCY = 3
const URL_BATCH_SIZE = 3
const PART_RETRIES = 3

// Reads any response as text first, so a non-JSON body (a proxy or platform
// error page) becomes a readable message instead of a JSON.parse exception.
async function readJson(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { error: `Request failed (${res.status})` }
  }
}

class UploadError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function formatSize(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

// Mirrors the local formatTime in app/notifications/page.tsx - no shared
// lib/ helper for this exists yet, so following the same per-component
// convention rather than introducing one for a single new caller.
function formatTime(iso: string) {
  const date = new Date(iso)
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

function uploaderLabel(profiles: RawFile['profiles']) {
  const p = Array.isArray(profiles) ? profiles[0] : profiles
  return p?.name ?? p?.email ?? 'Unknown'
}

// Raw camera-original archival via Backblaze B2 — a completely separate
// pipeline from the Mux-backed Custom Cut uploads above, so this is kept as
// its own visually distinct box (border + icon) rather than folded into the
// existing "Upload" button, same reasoning as the folder/asset icon split on
// Recycle Bin.
export function RawFootageArchive({ projectId, token }: RawFootageArchiveProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<RawFile[]>([])
  const [state, setState] = useState<UploadState>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()

  // Live upload session, so unmounting mid-upload can cancel it and abort the
  // multipart upload instead of leaving orphaned parts in the bucket.
  const sessionRef = useRef<UploadSession | null>(null)
  const tokenRef = useRef(token)
  tokenRef.current = token

  const authHeaders = () => ({ Authorization: `Bearer ${tokenRef.current}`, 'Content-Type': 'application/json' })

  const postJson = async (path: string, body: object) => {
    const res = await fetch(path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
    const data = await readJson(res)
    if (!res.ok) throw new UploadError(data.error ?? `Request failed (${res.status})`, res.status)
    return data
  }

  const loadFiles = async () => {
    const res = await fetch(`/api/raw-upload/list?projectId=${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await readJson(res)
      setFiles(data.rawFiles ?? [])
    }
  }

  useEffect(() => {
    loadFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, token])

  useEffect(() => {
    return () => {
      const session = sessionRef.current
      if (!session) return
      session.cancelled = true
      session.xhrs.forEach((xhr) => xhr.abort())
      // keepalive lets the abort request outlive the component/page.
      fetch('/api/raw-upload/multipart/abort', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ uploadToken: session.uploadToken }),
        keepalive: true,
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // One PUT straight to B2 via a presigned URL. No Authorization or custom
  // headers: the URL carries its own signature.
  const putPart = (url: string, blob: Blob, session: UploadSession, onProgress: (loaded: number) => void) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      session.xhrs.add(xhr)
      xhr.open('PUT', url)
      xhr.upload.onprogress = (e) => onProgress(e.loaded)
      xhr.onload = () => {
        session.xhrs.delete(xhr)
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new UploadError(`Part upload failed (${xhr.status})`, xhr.status))
      }
      xhr.onerror = () => { session.xhrs.delete(xhr); reject(new UploadError('Network error while uploading')) }
      xhr.onabort = () => { session.xhrs.delete(xhr); reject(new UploadError('Upload cancelled')) }
      xhr.send(blob)
    })

  const uploadParts = async (file: File, session: UploadSession, partSize: number, totalParts: number) => {
    const loaded = new Array<number>(totalParts + 1).fill(0)
    const reportProgress = () => {
      const sum = loaded.reduce((a, b) => a + b, 0)
      setProgress(Math.min(99, Math.floor((sum / file.size) * 100)))
    }
    const fetchUrls = async (partNumbers: number[]) => {
      const data = await postJson('/api/raw-upload/multipart/part', { uploadToken: session.uploadToken, partNumbers })
      return new Map<number, string>((data.urls as { partNumber: number; url: string }[]).map((u) => [u.partNumber, u.url]))
    }

    let nextPart = 1
    const worker = async () => {
      while (!session.cancelled) {
        // Claim a small batch and request its URLs only now, so a slow
        // connection never sits on URLs that expire before they are used.
        const batch: number[] = []
        while (batch.length < URL_BATCH_SIZE && nextPart <= totalParts) batch.push(nextPart++)
        if (batch.length === 0) return

        const urls = await fetchUrls(batch)
        for (const partNumber of batch) {
          const blob = file.slice((partNumber - 1) * partSize, Math.min(partNumber * partSize, file.size))
          let attempt = 0
          for (;;) {
            if (session.cancelled) throw new UploadError('Upload cancelled')
            try {
              await putPart(urls.get(partNumber)!, blob, session, (n) => { loaded[partNumber] = n; reportProgress() })
              loaded[partNumber] = blob.size
              reportProgress()
              break
            } catch (err) {
              const status = err instanceof UploadError ? err.status : undefined
              const retryable = status === undefined || status >= 500 || status === 403
              if (session.cancelled || !retryable || attempt >= PART_RETRIES) throw err
              attempt++
              loaded[partNumber] = 0
              await sleep(1000 * 2 ** (attempt - 1))
              if (status === 403) urls.set(partNumber, (await fetchUrls([partNumber])).get(partNumber)!)
            }
          }
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, totalParts) }, worker))
  }

  const handleFile = async (file: File) => {
    setError('')

    if (file.size > MAX_RAW_FILE_BYTES) {
      setError('File exceeds the 750MB archival limit')
      return
    }

    setState('uploading')
    setProgress(0)
    let session: UploadSession | null = null
    try {
      const init = await postJson('/api/raw-upload/multipart/initiate', {
        projectId,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
      })
      session = { uploadToken: init.uploadToken, cancelled: false, xhrs: new Set() }
      sessionRef.current = session

      await uploadParts(file, session, init.partSize, init.totalParts)
      await postJson('/api/raw-upload/multipart/complete', { uploadToken: session.uploadToken })

      sessionRef.current = null
      setProgress(100)
      setState('idle')
      invalidateStorageUsage()
      await loadFiles()
    } catch (err: any) {
      if (session && !session.cancelled) {
        session.cancelled = true
        session.xhrs.forEach((xhr) => xhr.abort())
        await postJson('/api/raw-upload/multipart/abort', { uploadToken: session.uploadToken }).catch(() => {})
      }
      sessionRef.current = null
      setError(err?.message ?? 'Upload failed')
      setState('error')
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDelete = async (f: RawFile) => {
    const ok = await confirm({
      title: 'Delete this file?',
      message: f.file_name,
      confirmLabel: 'Delete',
    })
    if (!ok) return

    const res = await fetch(`/api/raw-upload/${f.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      setFiles((prev) => prev.filter((row) => row.id !== f.id))
      invalidateStorageUsage()
    } else {
      const err = await readJson(res)
      setError(err.error ?? 'Failed to delete file')
    }
  }

  return (
    <div className="border border-th-border rounded-th-lg bg-th-surface-alt p-4">
      <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Archive size={14} className="text-th-muted" />
          <h3 className="text-[12px] font-bold">Raw Footage Archive</h3>
          <span className="font-mono text-[10px] text-th-faint">{files.length}</span>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={state === 'uploading'}
          className="flex items-center gap-1.5 h-7 px-3 rounded-th border border-th-border text-[12px] font-semibold btn-press hover:border-th-accent transition-colors disabled:opacity-50">
          <UploadCloud size={12} /> {state === 'uploading' ? `Uploading… ${progress}%` : 'Upload Raw Footage'}
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileInput} />
      </div>

      <p className="text-[11px] text-th-faint mb-3">
        Client-supplied camera-original files, uploaded here into CollabCut's storage — for archival only, not reviewed or played back here. Max 750MB per file.
      </p>

      {error && (
        <div className="mb-3 flex items-center gap-2 text-[12px] text-th-changes">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {files.length === 0 ? (
        <div className="rounded-th-sm bg-th-surface border border-th-border py-6 text-center">
          <p className="text-[12px] text-th-muted">No raw footage archived yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {files.map((f) => (
            <div
              key={f.id}
              className="group flex items-center gap-3 px-3 py-2 rounded-th-sm bg-th-surface border border-th-border hover:bg-th-surface-hov transition-colors">
              <FileIcon size={14} className="text-th-muted shrink-0" />
              <span className="text-[12px] font-medium truncate flex-1" title={f.file_name}>{f.file_name}</span>
              <span className="text-[11px] text-th-faint font-mono shrink-0 w-16 text-right">{formatSize(f.file_size_bytes)}</span>
              <span className="text-[11px] text-th-muted shrink-0 w-28 truncate">{uploaderLabel(f.profiles)}</span>
              <span className="text-[11px] text-th-faint font-mono shrink-0 w-16 text-right">{formatTime(f.created_at)}</span>
              <button
                onClick={() => handleDelete(f)}
                className="shrink-0 p-1 rounded-th-sm text-th-muted opacity-0 group-hover:opacity-100 hover:text-th-changes transition-opacity">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
