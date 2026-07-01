'use client'

import { useState, useRef } from 'react'
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface UploadModalProps {
  projectId: string
  onClose: () => void
  onUploaded: () => void
}

type UploadState = 'idle' | 'requesting' | 'uploading' | 'processing' | 'done' | 'error'

export function UploadModal({ projectId, onClose, onUploaded }: UploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
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
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Not logged in'); setState('error'); return }

      // Request Mux upload URL from our API
      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          name: file.name,
          version: 1,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to get upload URL')
      }

      const { upload_url } = await res.json()

      // Upload directly to Mux
      setState('uploading')
      await uploadToMux(file, upload_url)

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

  const uploadToMux = (file: File, url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100))
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`Upload failed: ${xhr.status}`))
      })

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')))

      xhr.open('PUT', url)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })
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
                <p className="font-semibold text-[14px] mb-1">Drop your video here</p>
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
              <div className="w-8 h-8 rounded-full border-2 border-th-accent border-t-transparent animate-spin mx-auto mb-4" />
              <p className="text-[13px] text-th-muted">Preparing upload…</p>
            </div>
          )}

          {/* Uploading */}
          {state === 'uploading' && (
            <div className="py-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-medium truncate pr-4">{fileName}</p>
                <span className="font-mono text-[12px] text-th-accent shrink-0">{progress}%</span>
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
            </div>
          )}

          {/* Processing */}
          {state === 'processing' && (
            <div className="py-8 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-th-accent border-t-transparent animate-spin mx-auto mb-4" />
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