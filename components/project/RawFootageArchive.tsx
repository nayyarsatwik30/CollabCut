'use client'

import { useEffect, useRef, useState } from 'react'
import { Archive, UploadCloud, AlertCircle, File as FileIcon, Trash2 } from 'lucide-react'
import { MAX_RAW_FILE_BYTES } from '@/lib/raw-files'
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
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()

  const loadFiles = async () => {
    if (!token) return
    const res = await fetch(`/api/raw-upload/list?projectId=${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setFiles(data.rawFiles ?? [])
    }
  }

  useEffect(() => {
    loadFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, token])

  const handleFile = async (file: File) => {
    setError('')

    if (file.size > MAX_RAW_FILE_BYTES) {
      setError('File exceeds the 750MB archival limit')
      return
    }

    if (!token) {
      setError('Not logged in')
      return
    }

    setState('uploading')
    try {
      const contentType = file.type || 'application/octet-stream'

      const presignRes = await fetch('/api/raw-upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId,
          fileName: file.name,
          contentType,
          fileSizeBytes: file.size,
        }),
      })
      if (!presignRes.ok) {
        const err = await presignRes.json()
        throw new Error(err.error ?? 'Failed to get upload URL')
      }
      const { uploadUrl, b2Key } = await presignRes.json()

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      })
      if (!putRes.ok) throw new Error(`Upload to B2 failed: ${putRes.status}`)

      const confirmRes = await fetch('/api/raw-upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          projectId,
          fileName: file.name,
          b2Key,
          fileSizeBytes: file.size,
          contentType,
        }),
      })
      if (!confirmRes.ok) {
        const err = await confirmRes.json()
        throw new Error(err.error ?? 'Failed to record uploaded file')
      }

      setState('idle')
      await loadFiles()
    } catch (err: any) {
      setError(err.message ?? 'Upload failed')
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
    if (!ok || !token) return

    const res = await fetch(`/api/raw-upload/${f.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      setFiles((prev) => prev.filter((row) => row.id !== f.id))
    } else {
      const err = await res.json()
      setError(err.error ?? 'Failed to delete file')
    }
  }

  return (
    <div className="mt-4 border border-th-border rounded-th-lg bg-th-surface-alt p-4">
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
          <UploadCloud size={12} /> {state === 'uploading' ? 'Uploading…' : 'Upload raw file'}
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileInput} />
      </div>

      <p className="text-[11px] text-th-faint mb-3">
        Camera-original files for archival only — not reviewed or played back here. Max 750MB per file.
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
