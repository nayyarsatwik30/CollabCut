'use client'

import { useEffect, useState } from 'react'
import { SimplePlayer } from '@/components/migration-demo/SimplePlayer'

interface SharedAsset {
  id: string
  name: string
  mux_playback_id: string | null
  duration_sec: string | number
  status: string
}

export default function SharePage({ params }: { params: { token: string } }) {
  const [asset, setAsset] = useState<SharedAsset | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/auth-migration/share?token=${encodeURIComponent(params.token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json()
          throw new Error(body.error ?? 'Invalid share link')
        }
        return res.json()
      })
      .then(setAsset)
      .catch((err) => setError(err.message))
  }, [params.token])

  return (
    <div className="flex flex-col min-h-screen">
      <header className="h-14 border-b border-th-border flex items-center px-6 shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="CollabCut" className="w-6 h-6 rounded-md" />
          <span className="text-[17px] font-extrabold tracking-tight">COLLABCUT</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {error && (
            <div className="px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
              {error}
            </div>
          )}

          {!error && !asset && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
            </div>
          )}

          {asset && (
            <div className="bg-th-surface border border-th-border rounded-th-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-th-border">
                <h1 className="font-bold text-[15px]">{asset.name}</h1>
              </div>
              <div className="p-5">
                {asset.mux_playback_id ? (
                  <SimplePlayer playbackId={asset.mux_playback_id} />
                ) : (
                  <p className="text-[13px] text-th-muted">Still processing…</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
