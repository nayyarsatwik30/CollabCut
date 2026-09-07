'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Film, UserPlus } from 'lucide-react'

export interface BoardAsset {
  id: string
  name: string
  pipeline_status: string
  is_complete: boolean
  project_id: string
  project_name: string
  editor: { id: string; name: string } | null
}

export interface BoardEditorOption {
  id: string
  name: string
  email: string
}

interface BoardCardProps {
  asset: BoardAsset
  color: string
  isAdmin: boolean
  editors: BoardEditorOption[]
  onAssign: (assetId: string, editorId: string) => void
  onDragStart: (e: React.DragEvent<HTMLDivElement>, assetId: string) => void
  onDragEnd: () => void
}

function initialsFor(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'
}

export function BoardCard({ asset, color, isAdmin, editors, onAssign, onDragStart, onDragEnd }: BoardCardProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const draggingRef = useRef(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const handleClick = () => {
    if (draggingRef.current) return
    router.push(`/review/${asset.id}`)
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        draggingRef.current = true
        onDragStart(e, asset.id)
      }}
      onDragEnd={() => {
        onDragEnd()
        setTimeout(() => { draggingRef.current = false }, 0)
      }}
      onClick={handleClick}
      className="group bg-th-surface border border-th-border rounded-th-lg p-3 cursor-pointer hover:border-th-accent transition-colors shadow-card hover:shadow-card-hover"
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-5 h-5 rounded-th-sm flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
        >
          <Film size={11} style={{ color }} />
        </span>
        {asset.is_complete && (
          <span
            className="ml-auto w-4 h-4 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, var(--th-resolved) 20%, transparent)', color: 'var(--th-resolved)' }}
            title="Marked complete"
          >
            <Check size={10} strokeWidth={3} />
          </span>
        )}
      </div>

      <p className="text-[13px] font-semibold leading-snug mb-0.5 line-clamp-2">{asset.name}</p>
      <p className="text-[11px] text-th-muted truncate mb-3">{asset.project_name}</p>

      <div className="flex items-center justify-between">
        {asset.editor ? (
          <div className="flex items-center gap-1.5 min-w-0" title={asset.editor.name}>
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold shrink-0"
              style={{ background: '#22D3EE', color: '#000' }}
            >
              {initialsFor(asset.editor.name)}
            </span>
            <span className="text-[11px] text-th-muted truncate">{asset.editor.name}</span>
          </div>
        ) : (
          <span className="text-[11px] text-th-faint italic">Unassigned</span>
        )}

        {isAdmin && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
              className="flex items-center gap-0.5 p-1 rounded-th-sm text-th-muted hover:text-th-text hover:bg-th-surface-alt transition-colors opacity-0 group-hover:opacity-100"
              style={menuOpen ? { opacity: 1 } : undefined}
              title="Assign editor"
            >
              <UserPlus size={12} />
              <ChevronDown size={10} />
            </button>

            {menuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 bottom-full mb-1 w-44 max-h-56 overflow-y-auto bg-th-surface border border-th-border rounded-th-sm shadow-panel z-20 py-1"
              >
                {editors.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-th-muted">No editors in workspace</p>
                ) : (
                  editors.map((ed) => (
                    <button
                      key={ed.id}
                      onClick={() => { onAssign(asset.id, ed.id); setMenuOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-th-surface-alt transition-colors"
                    >
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-extrabold shrink-0"
                        style={{ background: '#22D3EE', color: '#000' }}
                      >
                        {initialsFor(ed.name)}
                      </span>
                      <span className="truncate flex-1">{ed.name}</span>
                      {asset.editor?.id === ed.id && <Check size={12} style={{ color: 'var(--th-accent)' }} />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
