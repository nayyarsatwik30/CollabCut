'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sidebar } from '@/components/layout/Sidebar'
import { Clock, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Highlight {
  id: string
  asset_id: string
  asset_name: string
  project_name: string
  time_sec: number
  author_name: string
  status: string
  text: string
  created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  open: 'var(--th-open)',
  resolved: 'var(--th-resolved)',
  changes: 'var(--th-changes)',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'OPEN',
  resolved: 'RESOLVED',
  changes: 'NEEDS CHANGES',
}

function formatTimecode(sec: number) {
  const fps = 24
  const totalFrames = Math.floor(sec * fps)
  const h = Math.floor(totalFrames / (3600 * fps))
  const m = Math.floor((totalFrames % (3600 * fps)) / (60 * fps))
  const s = Math.floor((totalFrames % (60 * fps)) / fps)
  const f = totalFrames % fps
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`
}

export default function RecentPage() {
  const router = useRouter()
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHighlights()
  }, [])

  const loadHighlights = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }

    const res = await fetch('/api/highlights', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setHighlights(data.highlights ?? [])
    }
    setLoading(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center px-6">
          <h1 className="text-[15px] font-bold">Recent Highlights</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
            </div>
          ) : highlights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <Clock size={28} className="text-th-faint" />
              <p className="font-semibold">No recent activity</p>
              <p className="text-[13px] text-th-muted">Notes left across your projects will show up here.</p>
            </div>
          ) : (
            <div className="max-w-2xl space-y-2.5">
              {highlights.map((h) => (
                <Link
                  key={h.id}
                  href={`/review/${h.asset_id}`}
                  className="block bg-th-surface border border-th-border rounded-th p-4 hover:border-th-accent transition-colors"
                  style={{ borderLeftWidth: 3, borderLeftColor: STATUS_COLOR[h.status] ?? 'var(--th-accent)' }}
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[13px] font-semibold">{h.author_name}</span>
                    <span className="text-[12px] text-th-muted">left a note on</span>
                    <span className="text-[13px] font-semibold text-th-accent">{h.asset_name}</span>
                    <span className="text-[11px] text-th-faint font-mono">in {h.project_name}</span>
                  </div>
                  <p className="text-[13px] text-th-text mb-2 line-clamp-2">{h.text}</p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-th-full"
                      style={{ color: STATUS_COLOR[h.status], background: `color-mix(in srgb, ${STATUS_COLOR[h.status]} 14%, transparent)` }}>
                      {STATUS_LABEL[h.status] ?? h.status.toUpperCase()}
                    </span>
                    <span className="font-mono text-[10px] text-th-muted">@ {formatTimecode(h.time_sec)}</span>
                    <span className="font-mono text-[10px] text-th-faint ml-auto">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}