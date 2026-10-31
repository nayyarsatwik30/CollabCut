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
  const rootRef = useRef<HTMLDivElement>(null)
  const addingRef = useRef(false)
  const [popRight, setPopRight] = useState(12)
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
    addingRef.current = adding
    if (adding) inputRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [adding])

  // Anchor the hint/error overlay above the inline input (right-aligned to it,
  // kept inside the footer). Absolute + out of flow, so height never changes.
  useEffect(() => {
    if (!adding) return
    const place = () => {
      const root = rootRef.current?.getBoundingClientRect()
      const inp = inputRef.current?.getBoundingClientRect()
      if (!root || !inp) return
      setPopRight(Math.max(12, Math.round(root.right - inp.right)))
    }
    place()
    const list = stripRef.current
    list?.addEventListener('scroll', place)
    window.addEventListener('resize', place)
    return () => { list?.removeEventListener('scroll', place); window.removeEventListener('resize', place) }
  }, [adding, error, name])

  // Vertical wheel scrolls the tab list sideways (only when it overflows and
  // can still move that way; otherwise the page keeps the event).
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return // pinch-zoom / Ctrl+wheel: never hijack
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      // deltaY isn't always pixels: DOM_DELTA_LINE (1) and DOM_DELTA_PAGE (2)
      // need converting first.
      const delta = e.deltaMode === 1 ? e.deltaY * 18 : e.deltaMode === 2 ? e.deltaY * el.clientWidth : e.deltaY
      if ((delta < 0 && el.scrollLeft <= 0) || (delta > 0 && el.scrollLeft >= max)) return
      el.scrollLeft += delta
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Keep the active tab visible in the scrolling list, on change and after a
  // viewport resize (the list's visible width changes).
  useEffect(() => {
    const reveal = () => {
      // While the input is open keep IT in view instead of the active tab.
      if (addingRef.current) { inputRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' }); return }
      stripRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    }
    reveal()
    window.addEventListener('resize', reveal)
    return () => window.removeEventListener('resize', reveal)
  }, [activeKey, tabs.length])

  const startAdd = () => { doneRef.current = false; setAdding(true) }

  // fromBlur: an empty/whitespace name just cancels; Enter shows feedback instead.
  const submit = (returnFocus: boolean, fromBlur = false) => {
    if (doneRef.current) return
    if (!name.trim()) {
      if (fromBlur) { doneRef.current = true; close(returnFocus) }
      else setError('Enter a client name')
      return
    }
    const err = onAdd(name)
    if (err) { setError(err); return }
    doneRef.current = true
    close(returnFocus)
  }

  return (
    <div ref={rootRef} className="relative shrink-0 h-9 bg-th-surface border-t border-th-border flex items-stretch overflow-visible">
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
              onBlur={() => submit(false, true)}
              placeholder="Client name"
              aria-label="New client name"
              aria-invalid={!!error}
              title={error || ADD_HINT}
              // Inline style so the error state beats the global input:focus rule.
              style={error ? { borderColor: 'var(--th-changes)', boxShadow: '0 0 0 2px color-mix(in srgb, var(--th-changes) 35%, transparent)' } : undefined}
              className="w-[140px] h-6 px-2 text-[12px] rounded-th bg-th-bg border border-th-border text-th-text"
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
          style={{ right: popRight }}
          className={`pointer-events-none absolute bottom-full mb-1 max-w-[calc(100%-1.5rem)] z-20 rounded-th border px-2 py-1 text-[11px] bg-th-surface ${error ? 'border-th-changes text-th-changes' : 'border-th-border text-th-muted'}`}
        >
          {error || 'Saved on this device only until a project uses this name'}
        </div>
      )}
    </div>
  )
}
