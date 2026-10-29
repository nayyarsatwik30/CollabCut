'use client'

import { useState } from 'react'
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
}

// Footer client switcher shared by the Board and Projects pages.
export function ClientTabStrip({ tabs, allCount, countFor, activeKey, onSelect, onAdd }: ClientTabStripProps) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const close = () => { setAdding(false); setName(''); setError('') }

  return (
    <div
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
            className="w-36 px-2 py-1 text-[12px] rounded-th bg-th-bg border border-th-border text-th-text"
          />
          <Button type="submit" size="sm">Add</Button>
          {error && <span className="text-[11px] text-th-changes">{error}</span>}
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          aria-label="Add client tab"
          title="Add client"
          className="shrink-0 flex items-center px-3 py-2 text-th-muted hover:text-th-text btn-press"
        >
          <Plus size={14} />
        </button>
      )}
    </div>
  )
}
