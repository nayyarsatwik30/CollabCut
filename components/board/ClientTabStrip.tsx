'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { ALL_CLIENTS_KEY, countLabel, type ClientTab } from '@/lib/clients'

interface ClientTabStripProps {
  tabs: ClientTab[] // named client tabs (the "All clients" tab is added here)
  allCount: number
  countFor: (key: string) => number
  activeKey: string
  onSelect: (key: string) => void
  onAdd: (name: string) => string | null // error message or null
  countsUnavailable?: boolean // show an em dash instead of numbers (data failed to load)
  unit: 'cards' | 'projects' // what the per-tab numbers count (named in tooltips; the page header states it in words)
}

const ADD_HINT = 'Add client (saved on this device only until a project uses this name)'

// Footer client switcher shared by the Board and Projects pages: a sheet-style
// row of tabs plus a pinned "+". The footer is ONE fixed-height row (h-9) in
// every state; hints and errors are overlays (absolute, never in the flow).
export function ClientTabStrip({ tabs, allCount, countFor, activeKey, onSelect, onAdd, unit, countsUnavailable }: ClientTabStripProps) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const plusRef = useRef<HTMLButtonElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const refocusPlus = useRef(false)
  const doneRef = useRef(false) // guards against Enter + blur both submitting

  const close = (returnFocus: boolean) => {
    refocusPlus.current = returnFocus
    setAdding(false); setName(''); setError('')
  }

  // Return focus to "+" after Enter / Escape (not after a blur to elsewhere).
  useEffect(() => {
    if (!adding && refocusPlus.current) { refocusPlus.current = false; plusRef.current?.focus() }
  }, [adding])

  useEffect(() => {
    if (adding) inputRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [adding])

  // Keep the active tab visible in the scrolling list, on change and after a
  // viewport resize (the list's visible width changes).
  useEffect(() => {
    const reveal = () =>
      stripRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    reveal()
    window.addEventListener('resize', reveal)
    return () => window.removeEventListener('resize', reveal)
  }, [activeKey, tabs.length])

  const startAdd = () => { doneRef.current = false; setAdding(true) }

  const submit = (returnFocus: boolean) => {
    if (doneRef.current) return
    if (!name.trim()) { doneRef.current = true; close(returnFocus); return }
    const err = onAdd(name)
    if (err) { setError(err); return }
    doneRef.current = true
    close(returnFocus)
  }

  return (
    <div className="relative shrink-0 h-9 bg-th-surface border-t border-th-border flex items-stretch overflow-visible">
      <div
        ref={stripRef}
        role="group"
        aria-label="Filter by client"
        style={{ scrollbarWidth: 'none' }}
        className="flex-1 min-w-0 flex items-stretch gap-0.5 overflow-x-auto overflow-y-hidden px-3 [&::-webkit-scrollbar]:hidden"
      >
        {([{ key: ALL_CLIENTS_KEY, label: 'All clients', count: allCount }, ...tabs] as ClientTab[]).map((tab) => {
          const active = activeKey === tab.key
          return (
            <button
              key={tab.key}
              aria-pressed={active}
              title={`${tab.label}: ${countsUnavailable ? 'count unavailable' : countLabel(tab.key === ALL_CLIENTS_KEY ? allCount : countFor(tab.key), unit)}`}
              onClick={() => onSelect(tab.key)}
              className="shrink-0 flex items-center gap-1.5 px-3 text-[12px] border-b-2 btn-press transition-colors max-w-[200px] hover:bg-[color-mix(in_srgb,var(--th-text)_6%,transparent)]"
              style={{
                color: active ? 'var(--th-accent-text)' : 'var(--th-muted)',
                borderColor: active ? 'var(--th-accent)' : 'transparent',
                background: active ? 'var(--th-bg)' : undefined,
                fontWeight: active ? 700 : 400,
              }}
            >
              <span className="truncate">{tab.label}</span>
              <span className="font-mono text-[10px] opacity-70">{countsUnavailable ? '\u2014' : tab.key === ALL_CLIENTS_KEY ? allCount : countFor(tab.key)}</span>
            </button>
          )
        })}
        {adding && (
          <div className="shrink-0 flex items-center px-1">
            <input
              ref={inputRef}
              autoFocus
              value={name}
              maxLength={100}
              onChange={(e) => { setName(e.target.value); setError('') }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); submit(true) }
                else if (e.key === 'Escape') { doneRef.current = true; close(true) }
              }}
              onBlur={() => submit(false)}
              placeholder="Client name"
              aria-label="New client name"
              aria-invalid={!!error}
              title={error || ADD_HINT}
              className={`w-[140px] h-6 px-2 text-[12px] rounded-th bg-th-bg border text-th-text ${error ? 'border-th-changes ring-1 ring-th-changes' : 'border-th-border'}`}
            />
            {error && <span role="alert" className="sr-only">{error}</span>}
          </div>
        )}
      </div>
      <button
        ref={plusRef}
        type="button"
        onClick={startAdd}
        aria-label="Add client"
        title={ADD_HINT}
        className="shrink-0 w-9 flex items-center justify-center text-th-muted hover:text-th-text hover:bg-[color-mix(in_srgb,var(--th-text)_6%,transparent)] btn-press"
      >
        <Plus size={14} />
      </button>
      {/* Overlay (absolute, out of flow): the footer never changes height. */}
      {adding && (
        <div
          aria-hidden
          className={`pointer-events-none absolute bottom-full left-3 mb-1 max-w-[calc(100%-1.5rem)] z-20 rounded-th border px-2 py-1 text-[11px] bg-th-surface ${error ? 'border-th-changes text-th-changes' : 'border-th-border text-th-muted'}`}
        >
          {error || 'Saved on this device only until a project uses this name'}
        </div>
      )}
    </div>
  )
}
