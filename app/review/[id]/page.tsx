'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, Layers, ChevronDown, Share2, ThumbsUp, Check, Pencil, Square, Circle, Minus, Trash2, MessageSquare, Clock } from 'lucide-react'
import { ThemePicker } from '@/components/layout/ThemePicker'
import { VideoPlayer } from '@/components/review/VideoPlayer'
import { CommentPanel } from '@/components/review/CommentPanel'
import { VersionPanel } from '@/components/review/VersionPanel'
import { ActivityPanel } from '@/components/review/ActivityPanel'
import { ShareModal } from '@/components/review/ShareModal'
import { StatusBadge, Avatar } from '@/components/ui/Badge'
import { Toast, useToast } from '@/components/ui/Toast'
import { MOCK_COMMENTS, MOCK_VERSIONS, MOCK_ACTIVITY, MOCK_MEMBERS, MOCK_ASSETS } from '@/lib/mock-data'
import type { Comment, CommentStatus, AnnotationTool } from '@/lib/types'

type SideTab = 'notes' | 'versions' | 'activity'

export default function ReviewPage({ params }: { params: { id: string } }) {
  const asset = MOCK_ASSETS.find((a) => a.id === params.id) ?? MOCK_ASSETS[0]

  // Player state
  const [currentTime,    setCurrentTime]    = useState(0)
  const [duration,       setDuration]       = useState(0)

  // Comments state
  const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS)

  // UI state
  const [sideTab,        setSideTab]        = useState<SideTab>('notes')
  const [activeVersion,  setActiveVersion]  = useState(3)
  const [showVersions,   setShowVersions]   = useState(false)
  const [shareOpen,      setShareOpen]      = useState(false)
  const [approved,       setApproved]       = useState(false)
  const [drawTool,       setDrawTool]       = useState<AnnotationTool>(null)
  const [hasAnnotations, setHasAnnotations] = useState(false)

  const { toast, showToast, dismissToast } = useToast()

  // ── Comment handlers ─────────────────────────────────────────────────────
  const handleAddComment = useCallback((text: string, status: CommentStatus) => {
    const newComment: Comment = {
      id:          Date.now().toString(),
      assetId:     asset.id,
      timeSec:     currentTime,
      author:      'You',
      initials:    'YS',
      avatarColor: '#4CAF7D',
      status,
      text,
      replies:     [],
      resolved:    false,
      createdAt:   'just now',
    }
    setComments((prev) => [...prev, newComment].sort((a, b) => a.timeSec - b.timeSec))
    showToast('Note added', 'success')
  }, [currentTime, asset.id, showToast])

  const handleResolve = useCallback((id: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, resolved: !c.resolved, status: c.resolved ? 'open' : 'resolved' }
          : c
      )
    )
  }, [])

  const handleDelete = useCallback((id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
    showToast('Note deleted')
  }, [showToast])

  const handleReply = useCallback((commentId: string, text: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, replies: [...c.replies, { id: Date.now().toString(), author: 'You', initials: 'YS', avatarColor: '#4CAF7D', text, createdAt: 'just now' }] }
          : c
      )
    )
  }, [])

  const handleApprove = () => {
    setApproved(!approved)
    showToast(approved ? 'Approval removed' : '✓ Cut approved!', approved ? 'info' : 'success')
  }

  const handleVersionSwitch = (v: number) => {
    setActiveVersion(v)
    setShowVersions(false)
    showToast(`Switched to v${v}`)
  }

  const DRAW_TOOLS: { key: AnnotationTool; icon: React.ElementType; label: string }[] = [
    { key: 'line',   icon: Minus,  label: 'Line' },
    { key: 'rect',   icon: Square, label: 'Rectangle' },
    { key: 'circle', icon: Circle, label: 'Circle' },
    { key: 'arrow',  icon: Pencil, label: 'Draw' },
  ]

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-th-bg">

      {/* ── Toast ── */}
      <Toast toast={toast} onDismiss={dismissToast} />

      {/* ── Share modal ── */}
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onCopied={() => showToast('Review link copied!', 'success')}
      />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center gap-3 px-4 relative z-30">
        {/* Back */}
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 h-8 px-3 rounded-th-sm bg-th-surface-alt border border-th-border text-[12px] text-th-muted hover:text-th-text hover:bg-th-surface-hov transition-colors btn-press shrink-0"
        >
          <ChevronLeft size={13} /> Projects
        </Link>

        <div className="w-px h-5 bg-th-border shrink-0" />

        {/* File name + version picker */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[14px] font-semibold truncate">{asset.name}</span>
          <div className="relative shrink-0">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="flex items-center gap-1.5 h-6 px-2.5 rounded-th-full bg-th-surface-alt border border-th-border font-mono text-[11px] text-th-muted hover:text-th-text transition-colors btn-press"
            >
              <Layers size={10} />
              v{activeVersion}
              <ChevronDown size={10} />
            </button>

            {/* Version dropdown */}
            {showVersions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowVersions(false)} />
                <div className="absolute left-0 top-full mt-1.5 z-50 bg-th-surface border border-th-border rounded-th-lg shadow-panel w-56 overflow-hidden animate-slide-up">
                  <div className="px-4 py-2.5 border-b border-th-border font-mono text-[10px] text-th-muted uppercase tracking-wider">
                    Version history
                  </div>
                  {MOCK_VERSIONS.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleVersionSwitch(v.versionNumber)}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-left border-b border-th-border last:border-b-0 hover:bg-th-surface-alt transition-colors btn-press"
                    >
                      <Layers size={12} style={{ color: activeVersion === v.versionNumber ? 'var(--th-accent)' : 'var(--th-muted)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate" style={{ color: activeVersion === v.versionNumber ? 'var(--th-accent)' : 'var(--th-text)' }}>
                          {v.label}
                        </p>
                        <p className="font-mono text-[10px] text-th-muted">{v.uploadedAt} · {v.sizeLabel}</p>
                      </div>
                      {activeVersion === v.versionNumber && <Check size={12} className="text-th-accent shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <StatusBadge status={asset.status} />
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Member avatars */}
          <div className="flex items-center">
            {MOCK_MEMBERS.map((m, i) => (
              <div
                key={m.email}
                title={m.name}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold border-2 border-th-surface"
                style={{ background: m.avatarColor, color: '#000', marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i, position: 'relative' }}
              >
                {m.initials}
              </div>
            ))}
          </div>

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
            data-approved={approved || undefined}
          >
            {approved ? <><Check size={13} /> Approved</> : <><ThumbsUp size={13} /> Approve cut</>}
          </button>
        </div>
      </header>

      {/* ── Annotation toolbar ───────────────────────────────────────────── */}
      <div className="h-10 shrink-0 bg-th-surface border-b border-th-border flex items-center gap-2 px-4">
        <span className="font-mono text-[10px] uppercase tracking-wider text-th-muted mr-1">Annotate</span>

        {DRAW_TOOLS.map(({ key, icon: Icon, label }) => (
          <button
            key={String(key)}
            onClick={() => setDrawTool(drawTool === key ? null : key)}
            title={label}
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

        {drawTool && (
          <span className="font-mono text-[10px] text-th-muted ml-2">
            Click and drag on the video to draw
          </span>
        )}
      </div>

      {/* ── Main body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Player column */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <VideoPlayer
            comments={comments}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
            approved={approved}
          />
        </div>

        {/* Sidebar */}
        <aside className="w-85 shrink-0 bg-th-surface border-l border-th-border flex flex-col overflow-hidden">
          {/* Side tabs */}
          <div className="flex shrink-0 border-b border-th-border">
            {([
              { key: 'notes',    icon: MessageSquare, label: `Notes (${comments.length})` },
              { key: 'versions', icon: Layers,        label: 'Versions' },
              { key: 'activity', icon: Clock,         label: 'Activity' },
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

          {/* Tab content — each handles its own overflow */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {sideTab === 'notes' && (
              <CommentPanel
                comments={comments}
                currentTime={currentTime}
                onSeek={(t) => {
                  // seek is handled inside VideoPlayer via ref in a real app
                  // for now just update currentTime visually
                }}
                onAdd={handleAddComment}
                onResolve={handleResolve}
                onDelete={handleDelete}
                onReply={handleReply}
              />
            )}
            {sideTab === 'versions' && (
              <VersionPanel
                versions={MOCK_VERSIONS}
                activeVersion={activeVersion}
                onSwitch={handleVersionSwitch}
                onUpload={() => showToast('Upload flow coming soon')}
              />
            )}
            {sideTab === 'activity' && (
              <ActivityPanel items={MOCK_ACTIVITY} />
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
