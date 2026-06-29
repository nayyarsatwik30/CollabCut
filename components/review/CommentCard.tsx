'use client'

import { useState } from 'react'
import { Check, Trash2, MessageSquare, CornerDownRight } from 'lucide-react'
import { Comment, CommentStatus } from '@/lib/types'
import { formatTimecode } from '@/lib/utils'
import { StatusBadge, Avatar } from '@/components/ui/Badge'

const STATUS_BORDER: Record<CommentStatus, string> = {
  open:     'var(--th-open)',
  resolved: 'var(--th-resolved)',
  changes:  'var(--th-changes)',
}

interface CommentCardProps {
  comment: Comment
  onSeek: (time: number) => void
  onResolve: (id: string) => void
  onDelete: (id: string) => void
  onReply: (id: string, text: string) => void
}

export function CommentCard({ comment: c, onSeek, onResolve, onDelete, onReply }: CommentCardProps) {
  const [replying,   setReplying]   = useState(false)
  const [replyText,  setReplyText]  = useState('')
  const [showActions,setShowActions] = useState(false)

  const submitReply = () => {
    if (!replyText.trim()) return
    onReply(c.id, replyText.trim())
    setReplyText('')
    setReplying(false)
  }

  return (
    <div
      className={`comment-card rounded-th bg-th-surface border border-th-border mb-2.5 overflow-hidden ${c.resolved ? 'resolved' : ''}`}
      style={{ borderLeftColor: STATUS_BORDER[c.status] }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); if (!replying) {} }}
    >
      {/* Main content */}
      <div className="p-3.5">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-2.5">
          <Avatar initials={c.initials} color={c.avatarColor} size="sm"
            style={{ boxShadow: `0 0 0 2px var(--th-surface), 0 0 0 4px ${c.avatarColor}44` } as React.CSSProperties}
          />
          <div className="flex-1 min-w-0">
            <span className="text-[12px] font-semibold">{c.author}</span>
            <span className="text-[10px] text-th-muted font-mono ml-2">{c.createdAt}</span>
          </div>
          {/* Timecode jump */}
          <button
            onClick={() => onSeek(c.timeSec)}
            className="font-mono text-[10px] px-2 py-0.5 rounded-th-sm btn-press transition-colors"
            style={{ color: 'var(--th-accent)', background: 'color-mix(in srgb, var(--th-accent) 14%, transparent)' }}
          >
            {formatTimecode(c.timeSec)}
          </button>
        </div>

        {/* Note text */}
        <p className="text-[13px] leading-relaxed text-th-text mb-3">{c.text}</p>

        {/* Footer */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={c.status} />

          <div className={`ml-auto flex items-center gap-1.5 transition-opacity duration-100 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
            <button
              onClick={() => setReplying(!replying)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-th-sm bg-th-surface-alt border border-th-border text-[11px] text-th-muted hover:text-th-text transition-colors btn-press"
            >
              <MessageSquare size={11} />
              Reply
              {c.replies.length > 0 && (
                <span className="font-mono text-[10px] font-bold text-th-accent">{c.replies.length}</span>
              )}
            </button>

            <button
              onClick={() => onResolve(c.id)}
              title={c.resolved ? 'Reopen' : 'Mark resolved'}
              className="w-7 h-7 rounded-th-sm border border-th-border flex items-center justify-center btn-press transition-colors"
              style={{
                background: c.resolved ? 'color-mix(in srgb, var(--th-resolved) 18%, transparent)' : 'var(--th-surface-alt)',
                color: c.resolved ? 'var(--th-resolved)' : 'var(--th-muted)',
              }}
            >
              <Check size={12} />
            </button>

            <button
              onClick={() => onDelete(c.id)}
              title="Delete note"
              className="w-7 h-7 rounded-th-sm bg-th-surface-alt border border-th-border flex items-center justify-center btn-press text-th-changes hover:bg-th-changes/10 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* Replies */}
      {c.replies.length > 0 && (
        <div className="border-t border-th-border bg-th-surface-alt">
          {c.replies.map((r) => (
            <div key={r.id} className="flex gap-2.5 px-4 py-2.5 border-b border-th-border last:border-b-0">
              <CornerDownRight size={12} className="text-th-faint mt-1 shrink-0" />
              <Avatar initials={r.initials} color={r.avatarColor} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-semibold">{r.author}</span>
                  <span className="text-[10px] text-th-faint font-mono">{r.createdAt}</span>
                </div>
                <p className="text-[12px] text-th-text leading-relaxed">{r.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {replying && (
        <div className="border-t border-th-border p-3 flex gap-2 bg-th-surface">
          <input
            autoFocus
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply() } if (e.key === 'Escape') { setReplying(false); setReplyText('') } }}
            placeholder="Write a reply… (Enter to send)"
            className="flex-1 px-3 py-2 rounded-th-sm bg-th-surface-alt border border-th-border text-[12px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors font-display"
          />
          <button onClick={submitReply}
            className="px-3 py-2 rounded-th-sm bg-th-accent text-th-accent-fg text-[12px] font-semibold btn-press hover:opacity-90 transition-opacity">
            Send
          </button>
        </div>
      )}
    </div>
  )
}
