'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Layers, ChevronDown, Share2, ThumbsUp, Check, Pencil, Square, Circle, Minus, Trash2, MessageSquare, Clock } from 'lucide-react'
import { ThemePicker } from '@/components/layout/ThemePicker'
import { VideoPlayer } from '@/components/review/VideoPlayer'
import { CommentPanel } from '@/components/review/CommentPanel'
import { ShareModal } from '@/components/review/ShareModal'
import { StatusBadge, Avatar } from '@/components/ui/Badge'
import { Toast, useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import type { CommentStatus, AnnotationTool } from '@/lib/types'

type SideTab = 'notes' | 'versions' | 'activity'

interface Asset {
  id: string
  name: string
  version: number
  status: string
  mux_playback_id: string | null
  project_id: string
}

interface VersionEntry {
  id: string
  version: number
  name: string
  status: string
  created_at: string
  size_bytes: number
}

interface Comment {
  id: string
  asset_id: string
  time_sec: number
  author_id: string | null
  author_name: string
  status: CommentStatus
  text: string
  resolved: boolean
  created_at: string
  replies: any[]
}

export default function ReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter()

  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [userName, setUserName] = useState('You')

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [comments, setComments] = useState<Comment[]>([])

  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [showVersions, setShowVersions] = useState(false)

  const [sideTab, setSideTab] = useState<SideTab>('notes')
  const [shareOpen, setShareOpen] = useState(false)
  const [approved, setApproved] = useState(false)
  const [drawTool, setDrawTool] = useState<AnnotationTool>(null)
  const [hasAnnotations, setHasAnnotations] = useState(false)

  const { toast, showToast, dismissToast } = useToast()

  useEffect(() => {
    loadData()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/auth/login')
    })

    return () => listener.subscription.unsubscribe()
  }, [params.id])

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }
    setToken(session.access_token)
    setUserName(session.user.user_metadata?.name ?? session.user.email ?? 'You')

    const assetRes = await fetch(`/api/assets/${params.id}`)
    if (assetRes.ok) {
      const { asset: assetData } = await assetRes.json()
      setAsset(assetData)
      setApproved(assetData.status === 'approved')
    }

    const versionsRes = await fetch(`/api/assets/${params.id}/versions`)
    if (versionsRes.ok) {
      const { versions: v } = await versionsRes.json()
      setVersions(v)
    }

    const commentsRes = await fetch(`/api/comments?asset_id=${params.id}`)
    if (commentsRes.ok) {
      const data = await commentsRes.json()
      setComments(data.comments ?? [])
    }

    setLoading(false)
  }

  const handleAddComment = useCallback(async (text: string, status: CommentStatus) => {
    if (!token || !asset) return
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        asset_id: asset.id,
        time_sec: currentTime,
        text,
        status,
        author_name: userName,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setComments((prev) => [...prev, { ...data.comment, replies: [] }].sort((a, b) => a.time_sec - b.time_sec))
      showToast('Note added', 'success')
    }
  }, [currentTime, asset, token, userName, showToast])

  const handleResolve = useCallback(async (id: string) => {
    const target = comments.find((c) => c.id === id)
    if (!target) return
    const newResolved = !target.resolved
    const res = await fetch(`/api/comments/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ resolved: newResolved, status: newResolved ? 'resolved' : 'open' }),
    })
    if (res.ok) {
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, resolved: newResolved, status: newResolved ? 'resolved' : 'open' } : c))
      )
    }
  }, [comments, token])

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/comments/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id))
      showToast('Note deleted')
    }
  }, [showToast, token])

  const handleReply = useCallback(async (commentId: string, text: string) => {
    const res = await fetch(`/api/comments/${commentId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text, author_name: userName }),
    })
    if (res.ok) {
      const data = await res.json()
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, replies: [...(c.replies ?? []), data.reply] } : c))
      )
    }
  }, [userName, token])

  const handleApprove = async () => {
    if (!asset || !token) return
    const newApproved = !approved
    setApproved(newApproved)
    await fetch(`/api/projects/${asset.project_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: newApproved ? 'approved' : 'in_review' }),
    })
    showToast(newApproved ? '✓ Cut approved!' : 'Approval removed', newApproved ? 'success' : 'info')
  }

  const DRAW_TOOLS: { key: AnnotationTool; icon: React.ElementType; label: string }[] = [
    { key: 'line', icon: Minus, label: 'Line' },
    { key: 'rect', icon: Square, label: 'Rectangle' },
    { key: 'circle', icon: Circle, label: 'Circle' },
    { key: 'arrow', icon: Pencil, label: 'Draw' },
  ]

  const muxSrc = asset?.mux_playback_id
    ? `https://stream.mux.com/${asset.mux_playback_id}.m3u8`
    : undefined

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-th-bg">
        <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="flex h-screen items-center justify-center bg-th-bg text-th-text">
        <p>Asset not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-th-bg">
      <Toast toast={toast} onDismiss={dismissToast} />
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onCopied={() => showToast('Review link copied!', 'success')}
      />

      <header className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center gap-3 px-4 relative z-30">
        <Link
          href={`/project/${asset.project_id}`}
          className="flex items-center gap-1.5 h-8 px-3 rounded-th-sm bg-th-surface-alt border border-th-border text-[12px] text-th-muted hover:text-th-text hover:bg-th-surface-hov transition-colors btn-press shrink-0"
        >
          <ChevronLeft size={13} /> Project
        </Link>

        <div className="w-px h-5 bg-th-border shrink-0" />

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[14px] font-semibold truncate">{asset.name}</span>

          <div className="relative shrink-0">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="flex items-center gap-1.5 h-6 px-2.5 rounded-th-full bg-th-surface-alt border border-th-border font-mono text-[11px] text-th-muted hover:text-th-text transition-colors btn-press"
            >
              <Layers size={10} />
              v{asset.version}
              <ChevronDown size={10} />
            </button>

            {showVersions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowVersions(false)} />
                <div className="absolute left-0 top-full mt-1.5 z-50 bg-th-surface border border-th-border rounded-th-lg shadow-panel w-56 overflow-hidden animate-slide-up">
                  <div className="px-4 py-2.5 border-b border-th-border font-mono text-[10px] text-th-muted uppercase tracking-wider">
                    Version history
                  </div>
                  {versions.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => { setShowVersions(false); router.push(`/review/${v.id}`) }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-left border-b border-th-border last:border-b-0 hover:bg-th-surface-alt transition-colors btn-press"
                    >
                      <Layers size={12} style={{ color: v.id === asset.id ? 'var(--th-accent)' : 'var(--th-muted)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate" style={{ color: v.id === asset.id ? 'var(--th-accent)' : 'var(--th-text)' }}>
                          v{v.version}
                        </p>
                        <p className="font-mono text-[10px] text-th-muted">{new Date(v.created_at).toLocaleDateString()}</p>
                      </div>
                      {v.id === asset.id && <Check size={12} className="text-th-accent shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <StatusBadge status={asset.status as any} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemePicker />
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-th bg-th-surface-alt border border-th-border text-[13px] text-th-text font-medium btn-press hover:bg-th-surface-hov transition-colors"
          >
            <Share2 size={13} /> Share
          </button>
          <button
            onClick={handleApprove}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-th text-[13px] font-bold btn-press transition-all approve-glow"
            style={{
              background: approved ? 'var(--th-resolved)' : 'var(--th-accent)',
              color: approved ? '#fff' : 'var(--th-accent-fg)',
            }}
          >
            {approved ? <><Check size={13} /> Approved</> : <><ThumbsUp size={13} /> Approve cut</>}
          </button>
        </div>
      </header>

      <div className="h-10 shrink-0 bg-th-surface border-b border-th-border flex items-center gap-2 px-4">
        <span className="font-mono text-[10px] uppercase tracking-wider text-th-muted mr-1">Annotate</span>
        {DRAW_TOOLS.map(({ key, icon: Icon, label }) => (
          <button
            key={String(key)}
            onClick={() => setDrawTool(drawTool === key ? null : key)}
            className="flex items-center gap-1.5 h-7 px-3 rounded-th-sm text-[11px] btn-press transition-all"
            style={{
              background: drawTool === key ? 'color-mix(in srgb, var(--th-accent) 18%, transparent)' : 'transparent',
              color: drawTool === key ? 'var(--th-accent)' : 'var(--th-muted)',
              border: `1px solid ${drawTool === key ? 'var(--th-accent)' : 'var(--th-border)'}`,
            }}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
        {hasAnnotations && (
          <button
            onClick={() => { setHasAnnotations(false); setDrawTool(null) }}
            className="flex items-center gap-1.5 h-7 px-3 rounded-th-sm text-[11px] text-th-changes border border-th-changes/40 hover:bg-th-changes/10 transition-colors btn-press ml-1"
          >
            <Trash2 size={11} /> Clear
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {asset.status === 'processing' ? (
            <div className="flex-1 flex items-center justify-center bg-black">
              <div className="text-center">
                <div className="w-8 h-8 rounded-full border-2 border-th-accent border-t-transparent animate-spin mx-auto mb-4" />
                <p className="text-white text-[13px]">Mux is still processing this video…</p>
                <p className="text-white/50 text-[11px] mt-1">Refresh in a minute</p>
              </div>
            </div>
          ) : (
            <VideoPlayer
              src={muxSrc}
              comments={comments.map(c => ({
                id: c.id,
                timeSec: c.time_sec,
                status: c.status,
                text: c.text,
              })) as any}
              onTimeUpdate={setCurrentTime}
              onDurationChange={setDuration}
              approved={approved}
            />
          )}
        </div>

        <aside className="w-85 shrink-0 bg-th-surface border-l border-th-border flex flex-col overflow-hidden">
          <div className="flex shrink-0 border-b border-th-border">
            {([
              { key: 'notes', icon: MessageSquare, label: `Notes (${comments.length})` },
              { key: 'activity', icon: Clock, label: 'Activity' },
            ] as { key: SideTab; icon: React.ElementType; label: string }[]).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setSideTab(key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] border-b-2 btn-press transition-colors"
                style={{
                  color: sideTab === key ? 'var(--th-accent)' : 'var(--th-muted)',
                  borderColor: sideTab === key ? 'var(--th-accent)' : 'transparent',
                  fontWeight: sideTab === key ? 700 : 400,
                }}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {sideTab === 'notes' && (
              <CommentPanel
                comments={comments.map(c => ({
                  id: c.id,
                  timeSec: c.time_sec,
                  author: c.author_name,
                  initials: c.author_name?.[0]?.toUpperCase() ?? 'U',
                  avatarColor: '#4CAF7D',
                  status: c.status,
                  text: c.text,
                  replies: c.replies ?? [],
                  resolved: c.resolved,
                  createdAt: new Date(c.created_at).toLocaleString(),
                })) as any}
                currentTime={currentTime}
                onSeek={() => {}}
                onAdd={handleAddComment}
                onResolve={handleResolve}
                onDelete={handleDelete}
                onReply={handleReply}
              />
            )}
            {sideTab === 'activity' && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <div className="text-4xl">📋</div>
                <p className="font-semibold">No activity yet</p>
                <p className="text-[13px] text-th-muted">Activity will appear here as your team reviews.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}