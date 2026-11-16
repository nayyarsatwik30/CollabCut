'use client'

import { useRef, useState } from 'react'
import { CommentIcon, TimecodeIcon } from '@/components/ui/icons'
import { Comment, CommentStatus } from '@/lib/types'
import { formatTimecode } from '@/lib/utils'
import { CommentCard } from './CommentCard'
import { MAX_ATTACHMENTS_PER_COMMENT, MAX_COMMENT_ATTACHMENT_BYTES } from '@/lib/comment-attachment-rules'
import { AttachButton, DraftAttachmentList, useCommentAttachments } from './CommentAttachments'
import { Button } from '@/components/ui/Button'

type Filter = 'all' | CommentStatus

interface CommentPanelProps {
  comments: Comment[]
  currentTime: number
  onSeek: (time: number) => void
  onAdd: (text: string, status: CommentStatus, attachmentIds?: string[]) => Promise<boolean>
  /** Enables the Attach button (logged-in review screen only). */
  attachments?: { assetId: string; token: string | null }
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

// The selected option takes the status chip look (see globals.css): open is an
// outline, change is the danger colour, done is a lime fill.
const DRAFT_STATUS_OPTIONS: { key: CommentStatus; label: string; chip: string }[] = [
  { key: 'open',     label: 'Open',    chip: 'chip-open'    },
  { key: 'changes',  label: 'Change',  chip: 'chip-changes' },
  { key: 'resolved', label: 'Done',    chip: 'chip-resolved' },
]

export function CommentPanel({ comments, currentTime, onSeek, onAdd, onResolve, onDelete, onReply, attachments }: CommentPanelProps) {
  const [filter,       setFilter]       = useState<Filter>('all')
  const [draftText,    setDraftText]    = useState('')
  const [draftStatus,  setDraftStatus]  = useState<CommentStatus>('open')

  const drafts = useCommentAttachments(attachments?.assetId ?? null, attachments?.token ?? null)

  const filtered = filter === 'all'
    ? comments
    : comments.filter((c) => c.status === filter)

  const postingRef = useRef(false)

  const handleSubmit = async () => {
    if (!draftText.trim() || drafts.busy || drafts.errorCount > 0 || postingRef.current) return
    postingRef.current = true
    try {
      const submittedIds = [...drafts.ids] // snapshot: files added during the request aren't part of this post
      const ok = await onAdd(draftText.trim(), draftStatus, submittedIds)
      if (ok) {
        setDraftText('')
        drafts.clearPosted(submittedIds)
      }
    } finally {
      postingRef.current = false
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter row */}
      <div className="px-4 py-2.5 border-b border-th-border flex items-center gap-1.5 shrink-0">
        {FILTERS.map(({ key, label }) => (
          <Button
            key={key}
            variant="chip"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className="capitalize"
          >
            {label}
          </Button>
        ))}
        <span className="ml-auto font-mono text-[10px] text-th-faint">{filtered.length}</span>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <CommentIcon size={28} className="text-th-faint" />
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
          <span className="chip-time gap-1">
            <TimecodeIcon size={11} />
            AT {formatTimecode(currentTime)}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {attachments && <AttachButton onFiles={drafts.addFiles} disabled={drafts.full} />}
            {DRAFT_STATUS_OPTIONS.map(({ key, label, chip }) => (
              <button
                key={key}
                onClick={() => setDraftStatus(key)}
                aria-pressed={draftStatus === key}
                className={`px-2.5 py-0.5 rounded-th-full text-[10px] font-bold transition-colors btn-press ${draftStatus === key ? chip : 'chip-muted'}`}
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
          style={{ borderColor: draftText ? 'var(--th-accent-line)' : 'var(--th-border)' }}
        />

        {attachments && (
          <p aria-live="polite" className="mt-1.5 text-[10px] text-th-faint">
            {drafts.full
              ? 'Remove one to add another.'
              : `Attach up to ${MAX_ATTACHMENTS_PER_COMMENT} files (images, video, audio, PDF, text), ${MAX_COMMENT_ATTACHMENT_BYTES / 1024 / 1024}MB each`}
          </p>
        )}
        <DraftAttachmentList items={drafts.items} onRemove={drafts.remove} onRetry={drafts.retry} />
        {drafts.errorCount > 0 && (
          <p role="alert" className="mt-1.5 text-[11px] text-th-changes">
            {drafts.errorCount} file{drafts.errorCount > 1 ? 's' : ''} didn&apos;t attach - remove or retry.
          </p>
        )}
        {!draftText.trim() && drafts.ids.length > 0 && (
          <p className="mt-1.5 text-[11px] text-th-muted">Add a note to post your file.</p>
        )}

        {/* Submit — only visible when typing */}
        {draftText.trim() && (
          <Button
            onClick={handleSubmit}
            disabled={drafts.busy || drafts.errorCount > 0}
            className="mt-2 w-full animate-fade-in [--btn-fs:14px]"
          >
            <CommentIcon size={16} /> {drafts.busy ? 'Uploading file…' : `Post note at ${formatTimecode(currentTime)}`}
          </Button>
        )}
      </div>
    </div>
  )
}
