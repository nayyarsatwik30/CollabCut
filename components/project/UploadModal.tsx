'use client'

import { useState, useRef, useEffect } from 'react'
import { X, CircleCheck, CircleAlert, Ban } from '@/components/ui/icons'
import { UploadIcon } from '@/components/ui/icons'
import { useSession } from 'next-auth/react'
import { invalidateStorageUsage } from '@/lib/useStorageUsage'
import { Orb } from '@/components/ui/Orb'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { NO_CONNECTION_MESSAGE, UploadCancelledError, uploadOriginal } from '@/lib/original-upload-client'

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

  // Cancel bookkeeping. `uploadInfo` is only known once /api/assets/upload
  // answers, so a cancel during 'requesting' is finished by handleFile when
  // that response arrives.
  const abortRef = useRef<AbortController | null>(null)
  const uploadInfoRef = useRef<{ assetId: string; uploadId: string; cancelToken: string } | null>(null)
  const cancelledRef = useRef(false)

  const cancelOnServer = async (info: { assetId: string; uploadId: string; cancelToken: string }) => {
    try {
      await fetch(`/api/assets/${info.assetId}/cancel-upload`, {
        method: 'POST',
        keepalive: true, // still completes if the tab is closed right after cancelling
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_id: info.uploadId, cancel_token: info.cancelToken }),
      })
    } catch { /* nothing more to do from here */ }
  }

  const uploadInProgress = state === 'requesting' || state === 'uploading'

  useEffect(() => {
    if (!uploadInProgress) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'Upload in progress, leaving will cancel it'
      return e.returnValue
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploadInProgress])

  const handleCancel = () => {
    if (!window.confirm('Cancel this upload? The file will not be saved.')) return
    cancelledRef.current = true
    abortRef.current?.abort()
    // Server cleanup (Mux cancel + row update) runs in the background so the
    // modal closes at once; cancelOnServer swallows its own failures.
    const info = uploadInfoRef.current
    if (info) void cancelOnServer(info)
    onClose()
  }

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file')
      return
    }

    setFileName(file.name)
    setState('requesting')
    setError('')
    cancelledRef.current = false
    uploadInfoRef.current = null
    abortRef.current = new AbortController()

    try {
      if (status !== 'authenticated' || !session) { setError('Not logged in'); setState('error'); return }

      // Checked before the request below creates the asset row, so starting
      // an upload while offline never leaves a row stuck in "processing".
      if (!navigator.onLine) throw new Error(NO_CONNECTION_MESSAGE)

      // Ask our API to create the asset row and start the B2 upload. fetch() only rejects when the
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
          content_type: file.type,
          ...(linkedAsset ? { linked_asset_name: linkedAsset.name } : {}),
          ...(fulfillAssetId ? { fulfill_asset_id: fulfillAssetId } : {}),
        }),
      }).catch(() => { throw new Error(NO_CONNECTION_MESSAGE) })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to get upload URL')
      }

      const { asset, upload_token, part_size, total_parts, upload_id, cancel_token } = await res.json()
      uploadInfoRef.current = {
        assetId: asset.id,
        uploadId: upload_id,
        cancelToken: cancel_token,
      }

      // Cancelled while the request was in flight: the row exists now, so undo it.
      if (cancelledRef.current) {
        await cancelOnServer(uploadInfoRef.current)
        return
      }

      // The file goes to B2 once; the server then hands it to Mux itself.
      setState('uploading')
      setProgress(0)
      setUploadStatus('')
      await uploadOriginal(
        file,
        { uploadToken: upload_token, partSize: part_size, totalParts: total_parts },
        { onProgress: setProgress, onStatus: setUploadStatus, signal: abortRef.current?.signal },
      )
      // size_bytes was recorded when the row was created - once the bytes
      // actually land, refresh the sidebar/settings storage bar.
      invalidateStorageUsage()

      uploadInfoRef.current = null
      setState('processing')
      setTimeout(() => {
        setState('done')
        onUploaded()
      }, 2000)

    } catch (err: unknown) {
      if (cancelledRef.current || err instanceof UploadCancelledError) return
      // A failed upload must not leave a half-made asset or B2 parts behind.
      // The server refuses (409) once the file is fully stored, so this is
      // safe even when the failure came from the final step.
      const info = uploadInfoRef.current
      uploadInfoRef.current = null
      if (info) void cancelOnServer(info)
      setError(err instanceof Error ? err.message : 'Upload failed')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-th-surface border border-th-border rounded-th-lg w-full max-w-md shadow-panel animate-slide-up overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <h2 className="font-bold text-[16px]">Upload cut</h2>
          <IconButton size="sm" onClick={uploadInProgress ? handleCancel : onClose}
            label={uploadInProgress ? 'Cancel upload' : 'Close'}>
            <X size={16} />
          </IconButton>
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
                  borderColor: dragOver ? 'var(--th-accent-line)' : 'var(--th-border)',
                  background: dragOver ? 'color-mix(in srgb, var(--th-accent) 6%, transparent)' : 'var(--th-surface-alt)',
                }}
              >
                <UploadIcon size={28} className="mx-auto mb-3 text-th-muted" />
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
                  <CircleAlert size={13} /> {error}
                </div>
              )}
            </>
          )}

          {/* Requesting upload URL */}
          {state === 'requesting' && (
            <div className="py-8 text-center">
              <div className="flex justify-center mb-4"><Orb state="composing" size={64} label="Preparing upload" /></div>
              <p className="text-[13px] text-th-muted">Preparing upload…</p>
            </div>
          )}

          {/* Uploading */}
          {state === 'uploading' && (
            <div className="py-6">
              <div className="flex justify-center mb-4"><Orb state="composing" size={64} label="Uploading" /></div>
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
                Uploading your original file — do not close this window
              </p>
              <div className="mt-6 flex justify-center">
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <Ban size={13} /> Cancel upload
                </Button>
              </div>
              {uploadStatus && (
                <p className="mt-2 flex items-center gap-2 text-[12px] text-th-changes">
                  <CircleAlert size={13} /> {uploadStatus}
                </p>
              )}
            </div>
          )}

          {/* Processing */}
          {state === 'processing' && (
            <div className="py-8 text-center">
              <div className="flex justify-center mb-4"><Orb state="composing" size={64} label="Processing your video" /></div>
              <p className="font-semibold mb-1">Upload complete</p>
              <p className="text-[12px] text-th-muted">Mux is processing your video…</p>
              <Button variant="outline" size="xs" disabled className="mt-4">
                <Ban size={13} /> Cancel upload
              </Button>
              <p className="text-[11px] text-th-faint mt-1">Can&apos;t be cancelled once processing has started</p>
            </div>
          )}

          {/* Done */}
          {state === 'done' && (
            <div className="py-8 text-center">
              <CircleCheck size={36} className="mx-auto mb-3 text-th-text" />
              <p className="font-semibold mb-1">Video uploaded!</p>
              <p className="text-[12px] text-th-muted mb-5">
                It will be ready to review in 1–2 minutes while Mux transcodes it.
              </p>
              <Button onClick={onClose} className="[--btn-px:28px]">
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}