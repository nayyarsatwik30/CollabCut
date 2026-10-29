'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ALL_CLIENTS_KEY, type ClientTab } from '@/lib/clients'

interface ClientTabStripProps {
  tabs: ClientTab[] // named client tabs (the "All clients" tab is added here)
  allCount: number
  countFor: (key: string) => number
  activeKey: string
  onSelect: (key: string) => void
  onAdd: (name: string) => string | null // error message or null
  unit: 'cards' | 'projects' // what the per-tab numbers count
}

// Footer client switcher shared by the Board and Projects pages.
export function ClientTabStrip({ tabs, allCount, countFor, activeKey, onSelect, onAdd, unit }: ClientTabStripProps) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const plusRef = useRef<HTMLButtonElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const wasAdding = useRef(false)

  const close = () => { setAdding(false); setName(''); setError('') }

  // Return focus to "+" when the input closes (submit, Cancel or Escape).
  useEffect(() => {
    if (wasAdding.current && !adding) plusRef.current?.focus()
    wasAdding.current = adding
  }, [adding])

  // Keep the active tab visible in the scrolling strip.
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [activeKey])

  return (
    <div
      ref={stripRef}
      role="group"
      aria-label="Filter by client"
      className="shrink-0 bg-th-surface border-t border-th-border px-4 flex items-end gap-1 overflow-x-auto"
    >
      {([{ key: ALL_CLIENTS_KEY, label: 'All clients', count: allCount }, ...tabs] as ClientTab[]).map((tab) => {
        const active = activeKey === tab.key
        return (
          <button
            key={tab.key}
            aria-pressed={active}
            title={`${tab.label}: ${tab.key === ALL_CLIENTS_KEY ? allCount : countFor(tab.key)} ${unit}`}
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
            className="w-36 px-2 py-1 text-[12px] rounded-th bg-th-bg border border-th-border text-th-text"
          />
          <Button type="submit" size="sm">Add</Button>
          <Button type="button" size="sm" variant="secondary" onClick={close}>Cancel</Button>
          {error
            ? <span role="alert" className="text-[11px] text-th-changes whitespace-nowrap">{error}</span>
            : <span className="text-[11px] text-th-muted whitespace-nowrap">Saved on this device only until a project uses this name</span>}
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
      <span className="shrink-0 ml-auto pl-3 py-2 font-mono text-[10px] text-th-faint whitespace-nowrap">counts: {unit}</span>
    </div>
  )
}
