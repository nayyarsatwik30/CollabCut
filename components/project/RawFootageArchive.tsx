'use client'

import { useEffect, useRef, useState } from 'react'
import { Archive, CheckCircle2, CloudUpload, CircleAlert, Download, X, File as FileIcon, Film, Image as ImageIcon, Music, Trash2 } from 'lucide-react'
import { MAX_INLINE_PHOTO_BYTES, MAX_RAW_FILE_BYTES, classifyRawFile, type RawFileKind } from '@/lib/raw-files'
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
  kind?: RawFileKind
  preview_url?: string | null
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

const GENERIC_ERROR = 'Something went wrong. Please try again.'
const STORAGE_UNREACHABLE = "Couldn't reach storage. Check your internet connection and try again. If it keeps happening, contact support."

// Reads any response as text first, so a non-JSON body (a proxy or platform
// error page) becomes a readable message instead of a JSON.parse exception.
async function readJson(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { error: GENERIC_ERROR }
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
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  if (bytes < 1e3) return '<1 KB'
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
  const [errors, setErrors] = useState<{ id: number; text: string }[]>([])
  const [notice, setNotice] = useState('')
  const errorIdRef = useRef(0)
  // '' clears all messages; anything else appends one dismissible line.
  const setError = (text: string) => {
    if (!text) { setErrors([]); return }
    setErrors((prev) => [...prev, { id: ++errorIdRef.current, text }])
  }
  const uploading = state === 'uploading'
  const queueRef = useRef<File[]>([])
  const runningRef = useRef(false)
  const cancelRef = useRef(false)
  const batchRef = useRef({ done: 0, total: 0, ok: [] as string[] })
  const [progress, setProgress] = useState(0)
  const [queueLabel, setQueueLabel] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [listStatus, setListStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const listRequestRef = useRef(0)
  const [pickerAccept, setPickerAccept] = useState('')
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()

  // Live upload session, so unmounting mid-upload can cancel it and abort the
  // multipart upload instead of leaving orphaned parts in the bucket.
  const sessionRef = useRef<UploadSession | null>(null)
  const unmountedRef = useRef(false)
  const tokenRef = useRef(token)
  tokenRef.current = token

  const authHeaders = () => ({ Authorization: `Bearer ${tokenRef.current}`, 'Content-Type': 'application/json' })

  const postJson = async (path: string, body: object) => {
    const res = await fetch(path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
    const data = await readJson(res)
    if (!res.ok) {
      // 5xx / unknown bodies never reach the user as raw server text.
      const message = res.status >= 500 || typeof data.error !== 'string' ? GENERIC_ERROR : data.error
      throw new UploadError(message, res.status)
    }
    return data
  }

  // Always resolves to ok or error (never leaves the tab half-rendered), and
  // ignores a response that a newer request has overtaken.
  const loadFiles = async () => {
    const requestId = ++listRequestRef.current
    try {
      const res = await fetch(`/api/raw-upload/list?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
        cache: 'no-store',
      })
      const data = res.ok ? await readJson(res) : null
      if (requestId !== listRequestRef.current || unmountedRef.current) return
      if (data && Array.isArray(data.rawFiles)) {
        setFiles(data.rawFiles)
        setListStatus('ok')
      } else {
        setListStatus('error')
      }
    } catch {
      if (requestId === listRequestRef.current && !unmountedRef.current) setListStatus('error')
    }
  }

  useEffect(() => {
    setListStatus('loading')
    loadFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, token])

  // Presigned preview URLs last an hour: re-list well before that, and when a
  // thumbnail/player fails to load (laptop slept, tab left open).
  useEffect(() => {
    const id = setInterval(() => { if (!sessionRef.current) loadFiles() }, 40 * 60 * 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, token])

  const lastRefreshRef = useRef(0)
  const refreshOnMediaError = () => {
    if (Date.now() - lastRefreshRef.current < 30_000) return
    lastRefreshRef.current = Date.now()
    loadFiles()
  }

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      queueRef.current = []
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
      xhr.onerror = () => {
        session.xhrs.delete(xhr)
        console.warn('Part upload failed before a response (offline, or storage CORS blocking this origin)')
        reject(new UploadError(STORAGE_UNREACHABLE))
      }
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

  // Uploads one file; throws on failure (after aborting its multipart upload).
  const uploadOne = async (file: File) => {
    if (file.size > MAX_RAW_FILE_BYTES) throw new UploadError('This file is over 750MB. Compress it or split it into smaller files.')
    setProgress(0)
    let session: UploadSession | null = null
    try {
      let init
      try {
        init = await postJson('/api/raw-upload/multipart/initiate', {
          projectId,
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
        })
      } catch (err) {
        // Blocked or mismatched type (server returns 400 with a technical reason).
        if (err instanceof UploadError && err.status === 400 && /can't be uploaded|looks like/i.test(err.message)) {
          throw new UploadError("this file type can't be uploaded.", 400)
        }
        throw err
      }
      // Unmounted while initiate was in flight: cleanup saw no session, so
      // abort the fresh multipart upload here instead of uploading unseen.
      if (unmountedRef.current || cancelRef.current) {
        await postJson('/api/raw-upload/multipart/abort', { uploadToken: init.uploadToken }).catch(() => {})
        throw new UploadError('Upload cancelled')
      }
      session = { uploadToken: init.uploadToken, cancelled: false, xhrs: new Set() }
      sessionRef.current = session

      await uploadParts(file, session, init.partSize, init.totalParts)
      await postJson('/api/raw-upload/multipart/complete', { uploadToken: session.uploadToken })
      sessionRef.current = null
      setProgress(100)
    } catch (err) {
      if (session && !session.cancelled) {
        session.cancelled = true
        session.xhrs.forEach((xhr) => xhr.abort())
        await postJson('/api/raw-upload/multipart/abort', { uploadToken: session.uploadToken }).catch(() => {})
      }
      sessionRef.current = null
      throw err
    }
  }

  // One queue for the whole component: files dropped or picked while an
  // upload is running are appended to it. runningRef (not state) guards
  // against two quick drops starting two queues.
  const handleFiles = async (list: File[]) => {
    if (list.length === 0) return
    if (runningRef.current && cancelRef.current) return // cancelling: don't accept more
    if (!runningRef.current) {
      batchRef.current = { done: 0, total: 0, ok: [] }
      cancelRef.current = false
      setError('')
      setNotice('')
    }
    queueRef.current.push(...list)
    batchRef.current.total += list.length
    if (runningRef.current) return

    runningRef.current = true
    setState('uploading')
    const failures: string[] = []
    while (queueRef.current.length > 0 && !unmountedRef.current && !cancelRef.current) {
      const file = queueRef.current.shift()!
      const batch = batchRef.current
      batch.done++
      setQueueLabel(batch.total > 1 ? `file ${batch.done} of ${batch.total}: ${file.name}` : file.name)
      try {
        await uploadOne(file)
        batch.ok.push(file.name)
      } catch (err: any) {
        if (!cancelRef.current) failures.push(`${file.name}: ${err?.message ?? GENERIC_ERROR}`)
      }
    }
    runningRef.current = false
    if (unmountedRef.current) return
    const { ok } = batchRef.current
    setQueueLabel('')
    setState('idle')
    failures.forEach((f) => setError(f))
    if (cancelRef.current) setNotice(ok.length ? `Cancelled. ${ok.length} uploaded before cancelling.` : 'Upload cancelled.')
    else if (ok.length === 1) setNotice(`Uploaded ${ok[0]}`)
    else if (ok.length > 1) setNotice(`${ok.length} files uploaded`)
    invalidateStorageUsage()
    await loadFiles()
  }

  const cancelUploads = () => {
    cancelRef.current = true
    queueRef.current = []
    const session = sessionRef.current
    if (!session) return
    session.cancelled = true
    session.xhrs.forEach((xhr) => xhr.abort())
    postJson('/api/raw-upload/multipart/abort', { uploadToken: session.uploadToken }).catch(() => {})
  }

  // Warn before closing the tab mid-upload.
  useEffect(() => {
    if (!uploading) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [uploading])

  const pickFiles = (accept: string) => {
    setPickerAccept(accept)
    // accept is applied by React on the next render; defer the click.
    setTimeout(() => fileRef.current?.click(), 0)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? [])
    e.target.value = ''
    handleFiles(list)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped: File[] = []
    let sawFolder = false
    const items = Array.from(e.dataTransfer.items ?? [])
    if (items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
      // Entries must be read synchronously, before any await.
      for (const item of items) {
        if (item.kind !== 'file') continue
        if (item.webkitGetAsEntry()?.isDirectory) { sawFolder = true; continue }
        const file = item.getAsFile()
        if (file) dropped.push(file)
      }
    } else {
      for (const file of Array.from(e.dataTransfer.files)) {
        if (file.size === 0 && file.type === '') sawFolder = true
        else dropped.push(file)
      }
    }
    // handleFiles resets messages synchronously, so add the folder note after.
    handleFiles(dropped)
    if (sawFolder) setError("Folders can't be uploaded - add the files inside instead.")
  }

  const fetchUrl = async (f: RawFile, download: boolean): Promise<string | null> => {
    const res = await fetch(`/api/raw-upload/${f.id}/url${download ? '?download=1' : ''}`, {
      headers: { Authorization: `Bearer ${tokenRef.current}` },
    })
    const data = await readJson(res)
    if (!res.ok) {
      setError(res.status >= 500 || typeof data.error !== 'string' ? 'Could not open file. Try again, or download it instead.' : data.error)
      return null
    }
    return data.url as string
  }

  const handleDownload = async (f: RawFile) => {
    const url = await fetchUrl(f, true)
    if (url) window.location.assign(url)
  }

  const handleOpen = async (f: RawFile) => {
    // Open the tab synchronously (inside the click) so popup blockers allow it,
    // then point it at the presigned URL once we have it.
    const popup = window.open('', '_blank')
    if (!popup) {
      setError('Could not open file - allow pop-ups for this site.')
      return
    }
    popup.opener = null
    try {
      const url = await fetchUrl(f, false)
      if (url) popup.location.assign(url)
      else popup.close()
    } catch {
      popup.close()
      setError('Could not open file. Try again, or download it instead.')
    }
  }

  const handleDelete = async (f: RawFile) => {
    const ok = await confirm({
      title: 'Delete this file?',
      message: `${f.file_name} will be permanently removed and its storage freed.`,
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
      setError(res.status >= 500 || typeof err.error !== 'string' ? 'Failed to delete file. Please try again.' : err.error)
    }
  }

  const withKind = files.map((f) => ({ ...f, kind: f.kind ?? classifyRawFile(f.file_name, f.content_type) }))

  const columns: { kind: RawFileKind; title: string; hint: string; accept: string; icon: typeof Film; cta: string }[] = [
    { kind: 'video', title: 'Video footage', hint: 'Camera originals, ProRes, MXF, MP4', accept: 'video/*,.mxf,.r3d,.braw,.mts,.m2ts', icon: Film, cta: 'Add video' },
    { kind: 'audio', title: 'Audio', hint: 'Voice-over, music, WAV, MP3, M4A', accept: 'audio/*,.wav,.mp3,.m4a,.aac,.flac,.aif,.aiff', icon: Music, cta: 'Add audio' },
    { kind: 'photo', title: 'Photos', hint: 'JPG, PNG, HEIC, RAW stills', accept: 'image/*,.heic,.heif,.dng,.cr2,.cr3,.nef,.arw,.raf', icon: ImageIcon, cta: 'Add photos' },
  ]
  const others = withKind.filter((f) => f.kind === 'other')

  const actions = (f: RawFile) => (
    <div className="flex items-center gap-0.5 shrink-0">
      <button onClick={() => handleDownload(f)} title="Download" aria-label={`Download ${f.file_name}`}
        className="p-1 rounded-th-sm text-th-muted hover:text-th-text transition-colors">
        <Download size={13} />
      </button>
      <button onClick={() => handleDelete(f)} title="Delete" aria-label={`Delete ${f.file_name}`}
        className="p-1 rounded-th-sm text-th-muted hover:text-th-changes transition-colors">
        <Trash2 size={13} />
      </button>
    </div>
  )

  const meta = (f: RawFile) => (
    <span className="text-[10px] text-th-faint font-mono truncate">
      {formatSize(f.file_size_bytes)} · {uploaderLabel(f.profiles)} · {formatTime(f.created_at)}
    </span>
  )

  return (
    <div
      className={`border rounded-th-lg p-4 transition-colors ${dragOver ? 'border-th-accent border-dashed ring-2 ring-th-accent bg-th-surface-hov' : 'border-th-border bg-th-surface-alt'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false) }}
      onDrop={handleDrop}>
      <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      <input ref={fileRef} type="file" multiple accept={pickerAccept || undefined} className="hidden" onChange={handleFileInput} />

      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Archive size={14} className="text-th-muted" />
          <h3 className="text-[13px] font-bold">Raw Files</h3>
          <span className="font-mono text-[10px] text-th-faint">{files.length}</span>
        </div>
        <button
          onClick={() => pickFiles('')}
          disabled={uploading}
          className="flex items-center gap-1.5 h-8 px-3.5 rounded-th-full bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press hover:bg-th-accent-hover transition-colors disabled:opacity-50">
          <CloudUpload size={13} /> {uploading ? 'Uploading…' : 'Upload files'}
        </button>
      </div>

      <p className="text-[12px] text-th-muted mb-1">
        Camera originals, voice-over and music, and photos the client sent. Drag files anywhere in this box, or use an Add button below.
      </p>
      <p className="text-[11px] text-th-muted mb-4">
        Stored privately for admins and counted toward your storage. Photos and audio can be previewed here; video is archived for download only. Reviewing a cut? Upload it under Assets instead.
      </p>

      {uploading && (
        <div className="mb-4 rounded-th-sm bg-th-surface border border-th-border p-3" role="status">
          <div className="flex items-center justify-between text-[12px] mb-1.5 gap-3">
            <span className="truncate" title={queueLabel}>Uploading {queueLabel}</span>
            <span className="font-mono text-th-muted shrink-0">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-th-border overflow-hidden">
            <div className="h-full bg-th-accent transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5 gap-3">
            <p className="text-[11px] text-th-muted">Keep this tab open until it finishes. Files you add now join the queue.</p>
            <button onClick={cancelUploads}
              className="shrink-0 h-6 px-2.5 rounded-th-full border border-th-border text-[11px] font-semibold btn-press hover:border-th-changes hover:text-th-changes transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="mb-3 flex items-start gap-2 text-[12px] text-th-text" role="status">
          <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-th-accent" /> <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss" className="text-th-muted hover:text-th-text"><X size={12} /></button>
        </div>
      )}

      {errors.map((e) => (
        <div key={e.id} className="mb-2 flex items-start gap-2 text-[12px] text-th-changes" role="alert">
          <CircleAlert size={13} className="mt-0.5 shrink-0" /> <span className="flex-1">{e.text}</span>
          <button onClick={() => setErrors((prev) => prev.filter((x) => x.id !== e.id))} aria-label="Dismiss" className="hover:opacity-70"><X size={12} /></button>
        </div>
      ))}

      {listStatus === 'error' && (
        <div className="mb-3 flex items-center gap-2 text-[12px] text-th-changes" role="alert">
          <CircleAlert size={13} className="shrink-0" />
          <span>Couldn't load your files.</span>
          <button onClick={() => { setListStatus('loading'); loadFiles() }} className="underline font-semibold">Try again</button>
        </div>
      )}

      <div className="mb-4 rounded-th-sm border-2 border-dashed border-th-muted py-5 px-3 text-center flex flex-col items-center gap-1.5">
        <CloudUpload size={20} className="text-th-muted" />
        {listStatus === 'loading' ? (
          <div className="h-3 w-56 rounded bg-th-border animate-pulse" aria-label="Loading files" />
        ) : (
          <p className="text-[12px] text-th-text">
            {files.length === 0
              ? "Drop files here. They're sorted into Video, Audio or Photos automatically. Up to 750MB each."
              : 'Drop more files here to add them. Up to 750MB each.'}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map(({ kind, title, hint, accept, icon: Icon, cta }) => {
          const items = withKind.filter((f) => f.kind === kind)
          return (
            <section key={kind} className="rounded-th-sm bg-th-surface border border-th-border p-3 min-w-0" aria-label={title}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <Icon size={13} className="text-th-muted" />
                  <h4 className="text-[12px] font-bold">{title}</h4>
                  <span className="font-mono text-[10px] text-th-faint">{items.length}</span>
                </div>
                <button
                  onClick={() => pickFiles(accept)}
                  disabled={uploading}
                  className="flex items-center gap-1 h-6 px-2.5 rounded-th-full border border-th-border text-[11px] font-semibold btn-press hover:border-th-accent transition-colors disabled:opacity-50">
                  <CloudUpload size={11} /> {cta}
                </button>
              </div>
              <p className="text-[10px] text-th-faint mb-2">{hint}</p>

              {items.length === 0 ? (
                <p className="text-[11px] text-th-faint py-4 text-center">No {title.toLowerCase()} yet.</p>
              ) : kind === 'photo' ? (
                <div className="grid grid-cols-2 gap-2">
                  {items.map((f) => (
                    <div key={f.id} className="min-w-0 rounded-th-sm border border-th-border overflow-hidden">
                      <button onClick={() => (f.preview_url ? handleOpen(f) : handleDownload(f))} className="block w-full aspect-square bg-th-surface-alt" title={f.preview_url ? `Open ${f.file_name}` : `Download ${f.file_name}`}>
                        {f.preview_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.preview_url} alt={f.file_name} loading="lazy" onError={refreshOnMediaError} className="w-full h-full object-cover" />
                        ) : (
                          <span className="flex w-full h-full items-center justify-center text-th-faint"><ImageIcon size={22} /></span>
                        )}
                      </button>
                      {!f.preview_url && (
                        <p className="px-1.5 pt-1 text-[10px] text-th-muted">
                          {(f.file_size_bytes ?? 0) > MAX_INLINE_PHOTO_BYTES ? 'Too large to preview - download to view.' : 'No preview - download to view.'}
                        </p>
                      )}
                      <div className="flex items-center gap-1 px-1.5 py-1">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium truncate" title={f.file_name}>{f.file_name}</p>
                          <p className="text-[10px] text-th-faint font-mono truncate">{formatSize(f.file_size_bytes)}</p>
                        </div>
                        {actions(f)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {items.map((f) => (
                    <div key={f.id} className="rounded-th-sm border border-th-border px-2.5 py-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-medium truncate flex-1" title={f.file_name}>{f.file_name}</p>
                        {actions(f)}
                      </div>
                      {meta(f)}
                      {kind === 'audio' && f.preview_url && (
                        <audio controls preload="none" onError={refreshOnMediaError} src={f.preview_url} className="w-full h-8 mt-1.5" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>

      {others.length > 0 && (
        <section className="mt-4 rounded-th-sm bg-th-surface border border-th-border p-3" aria-label="Other files">
          <div className="flex items-center gap-1.5 mb-2">
            <FileIcon size={13} className="text-th-muted" />
            <h4 className="text-[12px] font-bold">Other files</h4>
            <span className="font-mono text-[10px] text-th-faint">{others.length}</span>
          </div>
          <div className="flex flex-col gap-1">
            {others.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-2.5 py-1.5 rounded-th-sm border border-th-border">
                <span className="text-[12px] font-medium truncate flex-1" title={f.file_name}>{f.file_name}</span>
                <span className="hidden sm:block">{meta(f)}</span>
                {actions(f)}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
