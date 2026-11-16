'use client'

import { useState } from 'react'
import { Trash2, CornerDownRight } from '@/components/ui/icons'
import { ApproveIcon, CommentIcon } from '@/components/ui/icons'
import { Comment, CommentStatus } from '@/lib/types'
import { formatTimecode } from '@/lib/utils'
import { StatusBadge, Avatar } from '@/components/ui/Badge'
import { CommentAttachmentList } from './CommentAttachments'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'

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
          <Avatar initials={c.initials} color={c.avatarColor} size="sm" />
          <div className="flex-1 min-w-0">
            <span className="text-[12px] font-semibold">{c.author}</span>
            <span className="text-[10px] text-th-muted font-mono ml-2">{c.createdAt}</span>
          </div>
          {/* Timecode jump */}
          <Button variant="chip" className="btn-chip-time" onClick={() => onSeek(c.timeSec)}>
            {formatTimecode(c.timeSec)}
          </Button>
        </div>

        {/* Note text */}
        <p className="text-[13px] leading-relaxed text-th-text mb-3">{c.text}</p>

        {/* Reference files attached to the note (members only) */}
        {c.attachments && c.attachments.length > 0 && <CommentAttachmentList attachments={c.attachments} />}

        {/* Footer */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={c.status} />

          <div className={`ml-auto flex items-center gap-1.5 transition-opacity duration-100 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
            <Button variant="outline" size="xs" onClick={() => setReplying(!replying)}>
              <CommentIcon size={12} />
              Reply
              {c.replies.length > 0 && (
                <span className="font-mono text-[10px] font-bold">{c.replies.length}</span>
              )}
            </Button>

            <IconButton
              size="sm"
              variant={c.resolved ? 'primary' : 'outline'}
              onClick={() => onResolve(c.id)}
              label={c.resolved ? 'Reopen' : 'Mark resolved'}
              aria-pressed={c.resolved}
            >
              <ApproveIcon size={13} />
            </IconButton>

            <IconButton size="sm" variant="danger" onClick={() => onDelete(c.id)} label="Delete note">
              <Trash2 size={11} />
            </IconButton>
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
            className="flex-1 px-3 py-2 rounded-th-sm bg-th-surface-alt border border-th-border text-[12px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent-line transition-colors font-display"
          />
          <Button size="sm" onClick={submitReply}>
            Send
          </Button>
        </div>
      )}
    </div>
  )
}
