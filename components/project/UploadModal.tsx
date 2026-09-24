'use client'

import { useState, useRef } from 'react'
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { useSession } from 'next-auth/react'
import * as UpChunk from '@mux/upchunk'
import { invalidateStorageUsage } from '@/lib/useStorageUsage'
import { Orb } from '@/components/ui/Orb'

// UpChunk pauses (rather than failing) while the browser reports itself
// offline and resumes on its own once it's back - but it would wait forever.
// Give up after this long so a dead connection ends in a real error instead
// of a progress bar frozen mid-way.
const OFFLINE_GIVE_UP_MS = 60_000

// UpChunk sets no request timeout, so a chunk whose connection silently stops
// moving (no error, no bytes) would hang forever. If nothing happens for this
// long while online, fail with a clear message instead. Generous on purpose:
// upload progress counts bytes handed to the OS socket buffer, so on a slow
// uplink it can sit at a chunk's end for minutes while that buffer drains -
// that is not a stall. 12 minutes = the largest chunk (MAX_CHUNK_SIZE_KB,
// 8 MB) divided by the slowest speed measured to Mux (~14 KB/s), which is
// ~9.8 minutes, plus headroom for the response and the next chunk's preflight.
const STALL_GIVE_UP_MS = 12 * 60_000

// Adaptive chunk sizes, all in KB and all multiples of 256 (required by the
// resumable-upload protocol). Editors upload from very different connections
// - office fibre to a phone hotspot - so no single fixed size suits everyone.
// UpChunk starts at CHUNK_SIZE_KB, doubles the size after a chunk that took
// under 10 s and halves it after one that took over 30 s, staying within the
// bounds below. Mux sends no preflight max-age, so every chunk pays a CORS
// preflight on top of its PUT: the 8 MB ceiling keeps that overhead low on
// fast links. The 1 MB floor keeps a drop mid-chunk cheap on slow ones, since
// a failed chunk is resent whole. The ceiling also caps how long one chunk can
// drain, which is what sizes the stall window above.
const CHUNK_SIZE_KB = 2048
const MIN_CHUNK_SIZE_KB = 1024
const MAX_CHUNK_SIZE_KB = 8192

// A dropped connection surfaces from UpChunk's XHR layer as status 0, which
// its default retry list (408/502/503/504) treats as fatal - one blip would
// end the whole upload. Retry it (and the other transient codes) instead.
const RETRY_CODES = [0, 408, 429, 500, 502, 503, 504]

const NO_CONNECTION_MESSAGE = 'Upload failed: no internet connection. Check your connection and try again.'

// Chunked, resumable upload straight to the Mux direct-upload URL. A single
// raw PUT of the whole file died on any network blip (surfacing in the
// browser as a misleading CORS error), leaving the asset row stuck in
// "processing" forever. Here chunks are adaptive, between 1 and 8 MB, and each
// is retried on its own - 10 attempts, 3s apart, so ~30s of flakiness per
// chunk is survivable - and the upload resumes from the last good chunk
// instead of starting over.
export function uploadFileToMux(
  file: File,
  url: string,
  onProgress: (percent: number) => void,
  onStatus: (message: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = UpChunk.createUpload({
      endpoint: url,
      file,
      chunkSize: CHUNK_SIZE_KB,
      dynamicChunkSize: true,
      minChunkSize: MIN_CHUNK_SIZE_KB,
      maxChunkSize: MAX_CHUNK_SIZE_KB,
      attempts: 10,
      delayBeforeAttempt: 3,
      retryCodes: RETRY_CODES,
    })

    // UpChunk's own 'online' listener calls sendChunks() unconditionally. If
    // the in-flight chunk survived the offline blip (it can), that starts a
    // second send loop next to the first: both pull chunks from one file
    // iterator but share one byte offset, so data lands at the wrong position
    // and Mux never gets a complete file - while UpChunk reports success.
    // Allow only one loop at a time. (Present in 3.5.0, the latest release.)
    const internals = upload as unknown as { sendChunks: () => Promise<void> }
    const sendChunks = internals.sendChunks.bind(upload)
    let sending: Promise<void> | null = null
    internals.sendChunks = () => {
      if (!sending) sending = sendChunks().finally(() => { sending = null })
      return sending
    }

    // UpChunk treats 308 ("resume incomplete") as a successful chunk. On the
    // last chunk Mux answers 200/201 once it has the whole file, so a final
    // 308 means it doesn't - never report that as a finished upload.
    let lastChunkStatus: number | undefined

    let settled = false
    let offlineTimer: ReturnType<typeof setTimeout> | undefined
    let stallTimer: ReturnType<typeof setTimeout> | undefined

    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(offlineTimer)
      clearTimeout(stallTimer)
      if (err) {
        upload.abort()
        reject(err)
      } else resolve()
    }

    // Re-armed on every sign of life; paused while offline (the offline
    // timer owns that case).
    const watchForStall = () => {
      clearTimeout(stallTimer)
      stallTimer = setTimeout(() => {
        finish(new Error('Upload failed: the connection stopped sending data. Check your connection and try again.'))
      }, STALL_GIVE_UP_MS)
    }

    const waitForReconnect = () => {
      onStatus('Connection lost - upload paused, it will resume automatically')
      clearTimeout(stallTimer)
      clearTimeout(offlineTimer)
      offlineTimer = setTimeout(() => finish(new Error(NO_CONNECTION_MESSAGE)), OFFLINE_GIVE_UP_MS)
    }

    upload.on('progress', (e) => {
      onProgress(Math.floor(e.detail))
      if (!upload.offline) watchForStall()
    })
    // Fires just before every chunk request - re-arms the timer so the gap
    // before that chunk's first progress event (preflight, reading a bigger
    // chunk from disk) is covered too.
    upload.on('attempt', () => {
      if (!upload.offline) watchForStall()
    })
    upload.on('attemptFailure', (e) => {
      onStatus(`Connection problem - retrying (${e.detail.attemptsLeft} attempts left)`)
      if (!upload.offline) watchForStall()
    })
    upload.on('chunkSuccess', (e) => {
      lastChunkStatus = e.detail.response?.statusCode
      onStatus('')
    })
    upload.on('offline', waitForReconnect)
    upload.on('online', () => {
      clearTimeout(offlineTimer)
      watchForStall()
      onStatus('Connection restored - resuming upload')
    })
    upload.on('success', () => finish(lastChunkStatus === 308
      ? new Error('Upload failed: Mux did not receive the whole file. Please try again.')
      : undefined))
    upload.on('error', (e) => {
      // Status 0 = never reached the server; after all retries that means
      // the connection kept dropping, not that Mux rejected the file.
      const status = e.detail.response?.statusCode
      finish(new Error(status
        ? `Upload failed: ${e.detail.message}`
        : 'Upload failed: the connection kept dropping. Check your connection and try again.'))
    })

    if (typeof navigator !== 'undefined' && !navigator.onLine) waitForReconnect()
    else watchForStall()
  })
}

interface UploadModalProps {
  projectId: string
  onClose: () => void
  onUploaded: () => void
  linkedAsset?: { id: string; name: string }
  cutType?: 'custom' | 'board'
  fulfillAssetId?: string
}

type UploadState = 'idle' | 'requesting' | 'uploading' | 'processing' | 'done' | 'error'

export function UploadModal({ projectId, onClose, onUploaded, linkedAsset, cutType = 'board', fulfillAssetId }: UploadModalProps) {
  const { data: session, status } = useSession()
  const fileRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file')
      return
    }

    setFileName(file.name)
    setState('requesting')
    setError('')

    try {
      if (status !== 'authenticated' || !session) { setError('Not logged in'); setState('error'); return }

      // Checked before the request below creates the asset row, so starting
      // an upload while offline never leaves a row stuck in "processing".
      if (!navigator.onLine) throw new Error(NO_CONNECTION_MESSAGE)

      // Request Mux upload URL from our API. fetch() only rejects when the
      // request never got through, which would otherwise surface as a bare
      // "Failed to fetch".
      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          name: file.name,
          version: 1,
          cut_type: cutType,
          size_bytes: file.size,
          ...(linkedAsset ? { linked_asset_name: linkedAsset.name } : {}),
          ...(fulfillAssetId ? { fulfill_asset_id: fulfillAssetId } : {}),
        }),
      }).catch(() => { throw new Error(NO_CONNECTION_MESSAGE) })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to get upload URL')
      }

      const { upload_url } = await res.json()

      // Upload directly to Mux
      setState('uploading')
      setProgress(0)
      setUploadStatus('')
      await uploadFileToMux(file, upload_url, setProgress, setUploadStatus)
      // size_bytes was recorded when the row was created - once the bytes
      // actually land, refresh the sidebar/settings storage bar.
      invalidateStorageUsage()

      setState('processing')
      setTimeout(() => {
        setState('done')
        onUploaded()
      }, 2000)

    } catch (err: any) {
      setError(err.message ?? 'Upload failed')
      setState('error')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-th-surface border border-th-border rounded-th-lg w-full max-w-md shadow-panel animate-slide-up overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <h2 className="font-bold text-[16px]">Upload cut</h2>
          <button onClick={onClose} disabled={state === 'uploading'}
            className="text-th-muted hover:text-th-text transition-colors disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          {/* Idle / drag state */}
          {(state === 'idle' || state === 'error') && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-th-lg p-10 text-center cursor-pointer transition-colors"
                style={{
                  borderColor: dragOver ? 'var(--th-accent)' : 'var(--th-border)',
                  background: dragOver ? 'color-mix(in srgb, var(--th-accent) 6%, transparent)' : 'var(--th-surface-alt)',
                }}
              >
                <Upload size={28} className="mx-auto mb-3 text-th-muted" />
                <p className="font-semibold text-[14px] mb-1">Drop your cut here</p>
                <p className="text-[12px] text-th-muted">or click to browse</p>
                <p className="text-[11px] text-th-faint font-mono mt-3">MP4, MOV, MXF, ProRes — any format</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileInput}
              />
              {error && (
                <div className="mt-3 flex items-center gap-2 text-[12px] text-th-changes">
                  <AlertCircle size={13} /> {error}
                </div>
              )}
            </>
          )}

          {/* Requesting upload URL */}
          {state === 'requesting' && (
            <div className="py-8 text-center">
              <div className="flex justify-center mb-4"><Orb state="working" size={32} label="Preparing upload" /></div>
              <p className="text-[13px] text-th-muted">Preparing upload…</p>
            </div>
          )}

          {/* Uploading */}
          {state === 'uploading' && (
            <div className="py-6">
              <div className="flex justify-center mb-4"><Orb state="working" size={32} label="Uploading" /></div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-medium truncate pr-4">{fileName}</p>
                <span className="font-mono text-[12px] text-th-accent-text shrink-0">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-th-surface-alt overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${progress}%`, background: 'var(--th-accent)' }}
                />
              </div>
              <p className="text-[11px] text-th-muted mt-3 font-mono">
                Uploading directly to Mux — do not close this window
              </p>
              {uploadStatus && (
                <p className="mt-2 flex items-center gap-2 text-[12px] text-th-changes">
                  <AlertCircle size={13} /> {uploadStatus}
                </p>
              )}
            </div>
          )}

          {/* Processing */}
          {state === 'processing' && (
            <div className="py-8 text-center">
              <div className="flex justify-center mb-4"><Orb state="working" size={32} label="Processing your video" /></div>
              <p className="font-semibold mb-1">Upload complete</p>
              <p className="text-[12px] text-th-muted">Mux is processing your video…</p>
            </div>
          )}

          {/* Done */}
          {state === 'done' && (
            <div className="py-8 text-center">
              <CheckCircle size={36} className="mx-auto mb-3" style={{ color: 'var(--th-resolved)' }} />
              <p className="font-semibold mb-1">Video uploaded!</p>
              <p className="text-[12px] text-th-muted mb-5">
                It will be ready to review in 1–2 minutes while Mux transcodes it.
              </p>
              <button onClick={onClose}
                className="px-6 py-2.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}