'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface NewContentModalProps {
  onClose: () => void
  onCreated: () => void
}

export function NewContentModal({ onClose, onCreated }: NewContentModalProps) {
  const [title, setTitle] = useState('')
  const [rawFileUrl, setRawFileUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [reference, setReference] = useState('')
  const [deadline, setDeadline] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Not logged in'); setSubmitting(false); return }

      const res = await fetch('/api/assets/new-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          raw_file_url: rawFileUrl.trim() || undefined,
          notes: notes.trim() || undefined,
          reference: reference.trim() || undefined,
          deadline: deadline || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create')
        setSubmitting(false)
        return
      }

      onCreated()
    } catch (err) {
      setError('Failed to create')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-th-surface border border-th-border rounded-th-lg w-full max-w-md shadow-panel animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
          <h2 className="font-bold text-[16px]">New content</h2>
          <button onClick={onClose} disabled={submitting}
            className="text-th-muted hover:text-th-text transition-colors disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
              {error}
            </div>
          )}

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-th-muted mb-1.5">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Wedding Promo — Singh & Mehta"
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-th-muted mb-1.5">Raw file</label>
            <input
              value={rawFileUrl}
              onChange={(e) => setRawFileUrl(e.target.value)}
              placeholder="Google Drive link"
              className="w-full px-3.5 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-th-muted mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Instructions for the editor…"
              className="w-full px-3.5 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-th-muted mb-1.5">Reference</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Style reference, link, or note"
              className="w-full px-3.5 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-th-muted mb-1.5">Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[14px] text-th-text outline-none focus:border-th-accent transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-th-border">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[13px] font-medium btn-press hover:bg-th-surface-hov transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-bold btn-press hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Plus size={14} /> {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
