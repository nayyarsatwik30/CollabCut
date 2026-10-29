'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Paperclip, X, Download, Eye, FileText, Film, Music, Image as ImageIcon, CircleAlert, Loader2 } from 'lucide-react'
import {
  ATTACHMENT_ACCEPT, MAX_ATTACHMENTS_PER_COMMENT, MAX_COMMENT_ATTACHMENT_BYTES, attachmentContentType, isInlineSafe,
} from '@/lib/comment-attachment-rules'
import { invalidateStorageUsage } from '@/lib/useStorageUsage'

export interface PostedAttachment {
  id: string
  file_name: string
  file_size_bytes: number | null
  content_type: string | null
}

interface DraftItem {
  key: string
  name: string
  size: number
  state: 'uploading' | 'done' | 'error'
  progress: number
  attachmentId?: string
  error?: string
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`
}

function iconFor(type: string | null) {
  if (type?.startsWith('image/')) return ImageIcon
  if (type?.startsWith('video/')) return Film
  if (type?.startsWith('audio/')) return Music
  return FileText
}

const FRIENDLY_FAILURE = "Upload didn't finish. Check your connection and try again."

async function readJson(res: Response): Promise<any> {
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { error: `Request failed (${res.status})` } }
}

// Draft attachments for the note being written: uploads straight to storage
// (progress), can be removed before the note is sent, and hands back the ids
// to post with the comment. Pending files are discarded if the draft is
// abandoned (asset switched / panel closed).
export function useCommentAttachments(assetId: string | null, token: string | null) {
  const [items, setItems] = useState<DraftItem[]>([])
  const xhrs = useRef(new Map<string, XMLHttpRequest>())
  const itemsRef = useRef<DraftItem[]>([])
  itemsRef.current = items
  const tokenRef = useRef(token)
  tokenRef.current = token
  const authHeaders = () => ({ Authorization: `Bearer ${tokenRef.current}`, 'Content-Type': 'application/json' })

  const patch = useCallback((key: string, next: Partial<DraftItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...next } : i)))
  }, [])

  const discardRemote = (attachmentId: string, keepalive = false) =>
    fetch(`/api/comments/attachments/${attachmentId}`, { method: 'DELETE', headers: authHeaders(), keepalive })
      .then(() => invalidateStorageUsage())
      .catch(() => {})

  // Keys removed/abandoned by the user: checked after every await so a
  // cancelled item never starts (or completes) an upload.
  const cancelled = useRef(new Set<string>())
  const fileStore = useRef(new Map<string, File>())

  const upload = async (file: File, key: string) => {
    const fail = (error: string, detail?: unknown) => {
      if (detail) console.warn('attachment upload failed:', detail)
      patch(key, { state: 'error', error })
    }
    try {
      const initRes = await fetch('/api/comments/attachments/initiate', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ assetId, fileName: file.name, fileSize: file.size }),
      })
      const init = await readJson(initRes)
      // 4xx messages are written for users; 5xx / unparsable become the generic one.
      if (!initRes.ok) return fail(initRes.status < 500 || initRes.status === 503 ? init.error ?? FRIENDLY_FAILURE : FRIENDLY_FAILURE, init)
      if (cancelled.current.has(key)) return // minted but never used: nothing recorded, nothing to clean up

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', init.url)
        xhr.upload.onprogress = (e) => patch(key, { progress: Math.min(99, Math.floor((e.loaded / file.size) * 100)) })
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`PUT status ${xhr.status}`)))
        xhr.onerror = () => reject(new Error('PUT network error'))
        xhr.onabort = () => reject(new Error('cancelled'))
        if (cancelled.current.has(key)) return reject(new Error('cancelled'))
        xhrs.current.set(key, xhr)
        // Blob with an empty type: XHR then sends no Content-Type, so the CORS
        // preflight needs no extra allowed header (same as the raw-footage parts).
        xhr.send(file.slice(0, file.size, ''))
      })
      xhrs.current.delete(key)

      if (cancelled.current.has(key)) return // removed while the last bytes were in flight - not completed

      const doneRes = await fetch('/api/comments/attachments/complete', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ uploadToken: init.uploadToken }),
      })
      const done = await readJson(doneRes)
      if (!doneRes.ok) return fail(FRIENDLY_FAILURE, done)

      if (cancelled.current.has(key)) {
        discardRemote(done.attachment.id) // user hit remove during the final request
        return
      }
      patch(key, { state: 'done', progress: 100, attachmentId: done.attachment.id })
      invalidateStorageUsage()
    } catch (err) {
      xhrs.current.delete(key)
      const message = (err as Error).message
      if (message !== 'cancelled') fail(FRIENDLY_FAILURE, message)
    }
  }

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files)
    let slots = MAX_ATTACHMENTS_PER_COMMENT - itemsRef.current.filter((i) => i.state !== 'error').length
    for (const file of list) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      let error: string | undefined
      if (slots <= 0) error = `Up to ${MAX_ATTACHMENTS_PER_COMMENT} files per note`
      else if (!attachmentContentType(file.name)) error = 'File type not allowed (images, video, audio, PDF, text)'
      else if (file.size <= 0) error = 'File is empty'
      else if (file.size > MAX_COMMENT_ATTACHMENT_BYTES) error = `Over the ${MAX_COMMENT_ATTACHMENT_BYTES / 1024 / 1024}MB limit`
      if (error) {
        setItems((prev) => [...prev, { key, name: file.name, size: file.size, state: 'error', progress: 0, error }])
        continue
      }
      slots--
      fileStore.current.set(key, file)
      setItems((prev) => [...prev, { key, name: file.name, size: file.size, state: 'uploading', progress: 0 }])
      void upload(file, key)
    }
  }

  const remove = (key: string) => {
    const item = itemsRef.current.find((i) => i.key === key)
    cancelled.current.add(key)
    fileStore.current.delete(key)
    xhrs.current.get(key)?.abort()
    xhrs.current.delete(key)
    setItems((prev) => prev.filter((i) => i.key !== key))
    if (item?.attachmentId) void discardRemote(item.attachmentId)
  }

  const retry = (key: string) => {
    const file = fileStore.current.get(key)
    if (!file) return
    // Failed rows don't hold a slot, so re-check the per-note limit first.
    if (itemsRef.current.filter((i) => i.state !== 'error').length >= MAX_ATTACHMENTS_PER_COMMENT) {
      patch(key, { error: `Up to ${MAX_ATTACHMENTS_PER_COMMENT} files per note - remove one to retry this file.` })
      return
    }
    patch(key, { state: 'uploading', progress: 0, error: undefined })
    void upload(file, key)
  }

  // After a successful post the uploaded files belong to the comment - forget
  // them without deleting anything. Only the submitted files are dropped; failed rows and files added mid-post stay.
  const clearPosted = (postedIds: string[]) =>
    setItems((prev) => prev.filter((i) => !(i.attachmentId && postedIds.includes(i.attachmentId))))

  // Drop unposted uploads when the draft goes away (asset switch / unmount).
  const abandon = () => {
    itemsRef.current.forEach((i) => cancelled.current.add(i.key))
    xhrs.current.forEach((x) => x.abort())
    xhrs.current.clear()
    itemsRef.current.forEach((i) => { if (i.attachmentId) void discardRemote(i.attachmentId, true) })
    setItems([])
  }
  const abandonRef = useRef(abandon)
  abandonRef.current = abandon
  useEffect(() => () => abandonRef.current(), [assetId])

  return {
    items,
    addFiles,
    remove,
    retry,
    clearPosted,
    errorCount: items.filter((i) => i.state === 'error').length,
    busy: items.some((i) => i.state === 'uploading'),
    ids: items.filter((i) => i.state === 'done' && i.attachmentId).map((i) => i.attachmentId as string),
    full: items.filter((i) => i.state !== 'error').length >= MAX_ATTACHMENTS_PER_COMMENT,
  }
}

export function AttachButton({ onFiles, disabled }: { onFiles: (files: FileList) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        title="Attach a reference file"
        className="flex items-center gap-1 h-6 px-2 rounded-th-full border border-th-border text-[10px] font-semibold text-th-muted hover:text-th-text hover:border-th-accent transition-colors btn-press disabled:opacity-40"
      >
        <Paperclip size={11} /> Attach
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = '' }}
      />
    </>
  )
}

export function DraftAttachmentList({ items, onRemove, onRetry }: { items: DraftItem[]; onRemove: (key: string) => void; onRetry?: (key: string) => void }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-1 mt-2">
      {items.map((i) => (
        <div key={i.key} className="rounded-th-sm bg-th-surface-alt border border-th-border px-2.5 py-1.5">
          <div className="flex items-center gap-2">
            {i.state === 'uploading' ? <Loader2 size={12} className="animate-spin text-th-muted shrink-0" />
              : i.state === 'error' ? <CircleAlert size={12} className="text-th-changes shrink-0" />
              : <Paperclip size={12} className="text-th-resolved shrink-0" />}
            <span className="text-[11px] truncate flex-1" title={i.name}>{i.name}</span>
            <span className="font-mono text-[10px] text-th-faint shrink-0">
              {i.state === 'uploading' ? `${i.progress}%` : formatSize(i.size)}
            </span>
            <button type="button" onClick={() => onRemove(i.key)} title="Remove" className="text-th-muted hover:text-th-changes shrink-0">
              <X size={12} />
            </button>
          </div>
          {i.state === 'uploading' && (
            <div className="mt-1 h-1 rounded-full bg-th-border overflow-hidden">
              <div className="h-full bg-th-accent transition-all" style={{ width: `${i.progress}%` }} />
            </div>
          )}
          {i.state === 'error' && (
            <p className="mt-0.5 text-[10px] text-th-changes">
              {i.error}
              {onRetry && i.error?.startsWith('Upload didn') && (
                <button type="button" onClick={() => onRetry(i.key)} className="ml-2 underline font-semibold">Retry</button>
              )}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// Attachments on a posted note: Preview (safe media only) and Download. The
// signed URL is requested at click time, so access is re-checked every time.
export function CommentAttachmentList({ attachments }: { attachments: PostedAttachment[] }) {
  const [preview, setPreview] = useState<{ url: string; name: string; type: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (!attachments || attachments.length === 0) return null

  const fetchUrl = async (a: PostedAttachment, inline: boolean) => {
    setError('')
    setBusyId(a.id)
    try {
      const res = await fetch(`/api/comments/attachments/${a.id}/download${inline ? '?inline=1' : ''}`)
      const data = await readJson(res)
      if (!res.ok) throw new Error(data.error ?? 'Could not open the file')
      return data as { url: string; inline: boolean }
    } catch (err) {
      setError((err as Error).message)
      return null
    } finally {
      setBusyId(null)
    }
  }

  const download = async (a: PostedAttachment) => {
    const data = await fetchUrl(a, false)
    if (!data) return
    const link = document.createElement('a')
    link.href = data.url
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const openPreview = async (a: PostedAttachment) => {
    const data = await fetchUrl(a, true)
    if (data?.inline) setPreview({ url: data.url, name: a.file_name, type: a.content_type ?? '' })
    else if (data) setError('This file cannot be previewed - download it instead.')
  }

  return (
    <div className="mb-3 flex flex-col gap-1">
      {attachments.map((a) => {
        const Icon = iconFor(a.content_type)
        return (
          <div key={a.id} className="flex items-center gap-2 rounded-th-sm bg-th-surface-alt border border-th-border px-2.5 py-1.5">
            <Icon size={12} className="text-th-muted shrink-0" />
            <span className="text-[11px] truncate flex-1" title={a.file_name}>{a.file_name}</span>
            <span className="font-mono text-[10px] text-th-faint shrink-0">{formatSize(a.file_size_bytes)}</span>
            {isInlineSafe(a.content_type) && (
              <button type="button" onClick={() => openPreview(a)} disabled={busyId === a.id} title="Preview"
                className="text-th-muted hover:text-th-text shrink-0 disabled:opacity-40"><Eye size={12} /></button>
            )}
            <button type="button" onClick={() => download(a)} disabled={busyId === a.id} title="Download"
              className="text-th-muted hover:text-th-text shrink-0 disabled:opacity-40"><Download size={12} /></button>
          </div>
        )
      })}
      {error && <p className="text-[10px] text-th-changes">{error}</p>}

      {preview && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6" onClick={() => setPreview(null)}>
          <button type="button" onClick={() => setPreview(null)} className="absolute top-4 right-4 text-white/80 hover:text-white" title="Close">
            <X size={20} />
          </button>
          <div className="max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            {preview.type.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt={preview.name} className="max-w-[90vw] max-h-[85vh] object-contain" />
            ) : preview.type.startsWith('video/') ? (
              <video src={preview.url} controls autoPlay className="max-w-[90vw] max-h-[85vh]" />
            ) : (
              <audio src={preview.url} controls autoPlay />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
