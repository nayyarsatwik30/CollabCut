'use client'

import { useState } from 'react'
import { Plus, MessageSquare } from 'lucide-react'
import { Comment, CommentStatus } from '@/lib/types'
import { formatTimecode } from '@/lib/utils'
import { CommentCard } from './CommentCard'

type Filter = 'all' | CommentStatus

interface CommentPanelProps {
  comments: Comment[]
  currentTime: number
  onSeek: (time: number) => void
  onAdd: (text: string, status: CommentStatus) => void
  onResolve: (id: string) => void
  onDelete: (id: string) => void
  onReply: (id: string, text: string) => void
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'open',     label: 'Open' },
  { key: 'changes',  label: 'Changes' },
  { key: 'resolved', label: 'Resolved' },
]

const DRAFT_STATUS_OPTIONS: { key: CommentStatus; label: string; color: string }[] = [
  { key: 'open',     label: 'Open',    color: 'var(--th-open)'     },
  { key: 'changes',  label: 'Change',  color: 'var(--th-changes)'  },
  { key: 'resolved', label: 'Done',    color: 'var(--th-resolved)' },
]

export function CommentPanel({ comments, currentTime, onSeek, onAdd, onResolve, onDelete, onReply }: CommentPanelProps) {
  const [filter,       setFilter]       = useState<Filter>('all')
  const [draftText,    setDraftText]    = useState('')
  const [draftStatus,  setDraftStatus]  = useState<CommentStatus>('open')

  const filtered = filter === 'all'
    ? comments
    : comments.filter((c) => c.status === filter)

  const handleSubmit = () => {
    if (!draftText.trim()) return
    onAdd(draftText.trim(), draftStatus)
    setDraftText('')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter row */}
      <div className="px-4 py-2.5 border-b border-th-border flex items-center gap-1.5 shrink-0">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="px-3 py-1 rounded-th-full text-[11px] font-medium transition-colors btn-press capitalize"
            style={{
              background: filter === key ? 'color-mix(in srgb, var(--th-accent) 18%, transparent)' : 'transparent',
              color: filter === key ? 'var(--th-accent)' : 'var(--th-muted)',
              border: `1px solid ${filter === key ? 'var(--th-accent)' : 'var(--th-border)'}`,
            }}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] text-th-faint">{filtered.length}</span>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <MessageSquare size={28} className="text-th-faint" />
            <div>
              <p className="text-[13px] font-semibold mb-1">
                {filter === 'all' ? 'No notes yet' : `No ${filter} notes`}
              </p>
              <p className="text-[12px] text-th-muted leading-relaxed">
                {filter === 'all'
                  ? 'Pause on any frame and leave a note below.'
                  : 'Notes with this status will appear here.'}
              </p>
            </div>
          </div>
        ) : (
          filtered.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              onSeek={onSeek}
              onResolve={onResolve}
              onDelete={onDelete}
              onReply={onReply}
            />
          ))
        )}
      </div>

      {/* Add note */}
      <div className="p-3.5 border-t border-th-border shrink-0 bg-th-surface">
        {/* Status selector + timecode label */}
        <div className="flex items-center gap-2 mb-2.5">
          <span className="font-mono text-[10px] text-th-accent font-bold">
            AT {formatTimecode(currentTime)}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {DRAFT_STATUS_OPTIONS.map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setDraftStatus(key)}
                className="px-2.5 py-0.5 rounded-th-full text-[10px] font-bold transition-colors btn-press"
                style={{
                  color,
                  background: draftStatus === key ? `color-mix(in srgb, ${color} 18%, transparent)` : 'transparent',
                  border: `1px solid ${draftStatus === key ? color : 'var(--th-border)'}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
          placeholder="Note this frame… (Enter to post, Shift+Enter for newline)"
          rows={3}
          className="w-full px-3 py-2.5 rounded-th bg-th-surface-alt border text-[13px] text-th-text placeholder:text-th-faint outline-none font-display resize-none leading-relaxed transition-colors"
          style={{ borderColor: draftText ? 'var(--th-accent)' : 'var(--th-border)' }}
        />

        {/* Submit — only visible when typing */}
        {draftText.trim() && (
          <button
            onClick={handleSubmit}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-bold btn-press hover:opacity-90 transition-opacity animate-fade-in"
            style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--th-accent) 40%, transparent)' }}
          >
            <Plus size={14} /> Post note at {formatTimecode(currentTime)}
          </button>
        )}
      </div>
    </div>
  )
}
