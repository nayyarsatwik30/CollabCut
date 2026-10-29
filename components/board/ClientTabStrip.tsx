'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ALL_CLIENTS_KEY, countLabel, type ClientTab } from '@/lib/clients'

interface ClientTabStripProps {
  tabs: ClientTab[] // named client tabs (the "All clients" tab is added here)
  allCount: number
  countFor: (key: string) => number
  activeKey: string
  onSelect: (key: string) => void
  onAdd: (name: string) => string | null // error message or null
  unit: 'cards' | 'projects' // what the per-tab numbers count (named in tooltips; the page header states it in words)
}

// Footer client switcher shared by the Board and Projects pages.
export function ClientTabStrip({ tabs, allCount, countFor, activeKey, onSelect, onAdd, unit }: ClientTabStripProps) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const plusRef = useRef<HTMLButtonElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const wasAdding = useRef(false)
  const noteId = useId()

  const close = () => { setAdding(false); setName(''); setError('') }

  // Return focus to "+" when the input closes (submit, Cancel or Escape).
  useEffect(() => {
    if (wasAdding.current && !adding) plusRef.current?.focus()
    wasAdding.current = adding
  }, [adding])

  // Keep the active tab visible in the scrolling strip, on change and after a
  // viewport resize (the strip's visible width changes).
  useEffect(() => {
    const reveal = () =>
      stripRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    reveal()
    window.addEventListener('resize', reveal)
    return () => window.removeEventListener('resize', reveal)
  }, [activeKey])

  return (
    <div className="shrink-0 bg-th-surface border-t border-th-border">
    {/* Hint / error live outside the scrolling row so they are visible at any width. */}
    {adding && (
      error
        ? <p id={noteId} role="alert" className="px-4 pt-2 text-[12px] text-th-changes">{error}</p>
        : <p id={noteId} className="px-4 pt-2 text-[12px] text-th-muted">Saved on this device only until a project uses this name</p>
    )}
    <div
      ref={stripRef}
      role="group"
      aria-label="Filter by client"
      className="px-4 flex items-end gap-1 overflow-x-auto"
    >
      {([{ key: ALL_CLIENTS_KEY, label: 'All clients', count: allCount }, ...tabs] as ClientTab[]).map((tab) => {
        const active = activeKey === tab.key
        return (
          <button
            key={tab.key}
            aria-pressed={active}
            title={`${tab.label}: ${countLabel(tab.key === ALL_CLIENTS_KEY ? allCount : countFor(tab.key), unit)}`}
            onClick={() => onSelect(tab.key)}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-[12px] border-t-2 btn-press transition-colors max-w-[200px]"
            style={{
              color: active ? 'var(--th-accent-text)' : 'var(--th-muted)',
              borderColor: active ? 'var(--th-accent)' : 'transparent',
              background: active ? 'var(--th-bg)' : 'transparent',
              fontWeight: active ? 700 : 400,
            }}
          >
            <span className="truncate">{tab.label}</span>
            <span className="font-mono text-[10px] opacity-70">{tab.key === ALL_CLIENTS_KEY ? allCount : countFor(tab.key)}</span>
          </button>
        )
      })}
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const err = onAdd(name)
            if (err) setError(err)
            else close()
          }}
          className="shrink-0 flex items-center gap-1.5 px-2 py-1.5"
        >
          <input
            autoFocus
            value={name}
            maxLength={100}
            onChange={(e) => { setName(e.target.value); setError('') }}
            onKeyDown={(e) => { if (e.key === 'Escape') close() }}
            placeholder="Client name"
            aria-label="New client name"
            aria-invalid={!!error}
            aria-describedby={noteId}
            className="w-36 px-2 py-1 text-[12px] rounded-th bg-th-bg border border-th-border text-th-text"
          />
          <Button type="submit" size="sm">Add</Button>
          <Button type="button" size="sm" variant="secondary" onClick={close}>Cancel</Button>
        </form>
      ) : (
        <button
          ref={plusRef}
          onClick={() => setAdding(true)}
          className="shrink-0 flex items-center gap-1 px-3 py-2 text-[12px] text-th-muted hover:text-th-text btn-press"
        >
          <Plus size={13} /> Add client
        </button>
      )}
    </div>
    </div>
  )
}
