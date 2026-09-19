'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Share2 } from 'lucide-react'
import { SimplePlayer } from '@/components/migration-demo/SimplePlayer'

interface Asset {
  id: string
  project_id: string
  name: string
  status: string
  duration_sec: string | number
  mux_playback_id: string | null
  mux_asset_id: string | null
  created_at: string
}

export default function ProjectPage({ params }: { params: { id: string } }) {
  const { status } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [asset, setAsset] = useState<Asset | null>(null)
  const [uploadState, setUploadState] = useState<'idle' | 'requesting' | 'uploading' | 'processing' | 'error'>('idle')
  const [error, setError] = useState('')
  const [shareUrl, setShareUrl] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/migration-demo/login')
  }, [status, router])

  async function pollAsset(assetId: string) {
    setUploadState('processing')
    const deadline = Date.now() + 10 * 60 * 1000
    while (Date.now() < deadline) {
      const res = await fetch(`/api/auth-migration/assets/${assetId}`)
      if (res.ok) {
        const data: Asset = await res.json()
        if (data.mux_playback_id) {
          setAsset(data)
          setUploadState('idle')
          return
        }
      }
      await new Promise((r) => setTimeout(r, 3000))
    }
    setError('Still processing after 10 minutes — check back later')
    setUploadState('error')
  }

  async function handleFile(file: File) {
    setError('')
    setUploadState('requesting')
    try {
      const res = await fetch('/api/auth-migration/assets/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: params.id, name: file.name }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to get upload URL')
      }
      const { upload_url, asset: newAsset } = await res.json()

      setUploadState('uploading')
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload failed: ${xhr.status}`))
        })
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
        xhr.open('PUT', upload_url)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })

      await pollAsset(newAsset.id)
    } catch (err: any) {
      setError(err.message ?? 'Upload failed')
      setUploadState('error')
    }
  }

  async function handleShare() {
    if (!asset) return
    const res = await fetch('/api/auth-migration/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: asset.id }),
    })
    if (!res.ok) {
      setError('Failed to create share link')
      return
    }
    const { token } = await res.json()
    setShareUrl(`${window.location.origin}/migration-demo/share/${token}`)
  }

  if (status !== 'authenticated') return null

  return (
    <div>
      <header className="h-14 border-b border-th-border flex items-center px-6 shrink-0">
        <a href="/migration-demo/dashboard" className="flex items-center gap-2 text-[13px] text-th-muted hover:text-th-text transition-colors">
          <ArrowLeft size={14} /> Dashboard
        </a>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {!asset && (
          <div>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed rounded-th-lg p-10 text-center cursor-pointer transition-colors border-th-border bg-th-surface-alt hover:border-th-accent"
            >
              <Upload size={28} className="mx-auto mb-3 text-th-muted" />
              <p className="font-semibold text-[14px] mb-1">Click to upload a video</p>
              <p className="text-[12px] text-th-muted">MP4, MOV, or any video format</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              disabled={uploadState !== 'idle' && uploadState !== 'error'}
            />

            {uploadState === 'requesting' && (
              <p className="mt-4 text-[13px] text-th-muted">Requesting upload URL…</p>
            )}
            {uploadState === 'uploading' && (
              <p className="mt-4 text-[13px] text-th-muted">Uploading to Mux…</p>
            )}
            {uploadState === 'processing' && (
              <div className="mt-4 flex items-center gap-2 text-[13px] text-th-muted">
                <div className="w-4 h-4 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
                Mux is processing your video — usually 1–2 minutes…
              </div>
            )}
          </div>
        )}

        {asset && asset.mux_playback_id && (
          <div className="bg-th-surface border border-th-border rounded-th-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-th-border flex items-center justify-between">
              <h2 className="font-bold text-[15px]">{asset.name}</h2>
              <button onClick={handleShare}
                className="flex items-center gap-1.5 h-8 px-3 rounded-th bg-th-surface-alt border border-th-border text-[13px] text-th-text btn-press hover:border-th-accent transition-colors">
                <Share2 size={13} /> Share
              </button>
            </div>
            <div className="p-5">
              <SimplePlayer playbackId={asset.mux_playback_id} />
              {shareUrl && (
                <p className="mt-4 text-[13px] text-th-muted break-all">
                  Share link: <a href={shareUrl} className="text-th-accent hover:underline">{shareUrl}</a>
                </p>
              )}
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-[13px] text-th-changes">{error}</p>}
      </div>
    </div>
  )
}
