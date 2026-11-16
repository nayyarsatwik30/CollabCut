'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Clock, Film, Trash2, UserPlus } from '@/components/ui/icons'
import { PriorityBadge } from '@/components/PriorityBadge'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { ApproveIcon } from '@/components/ui/icons'
import { PriorityMenu } from '@/components/PriorityMenu'
import { VersionBadge } from '@/components/board/VersionManager'

export interface BoardAsset {
  id: string
  name: string
  pipeline_status: string
  is_complete: boolean
  project_id: string
  project_name: string
  project_client: string
  editor: { id: string; name: string } | null
  mux_upload_id: string | null
  priority: number
  // Live versions in this asset's lineage; the card shows the latest one.
  version_count?: number
}

export interface BoardEditorOption {
  id: string
  name: string
  email: string
  assetCount?: number
  cutsPreview?: { id: string; title: string; status: string; priority: number }[]
}

export interface BoardColumnOption {
  key: string
  label: string
}

interface BoardCardProps {
  asset: BoardAsset
  color: string
  isAdmin: boolean
  token: string | null
  editors: BoardEditorOption[]
  columns: BoardColumnOption[]
  onAssign: (assetId: string, editorId: string) => void
  onStatusChange: (assetId: string, status: string) => void
  onPriorityChange: (assetId: string, priority: number) => void
  onDelete: (assetId: string) => void
  onVersionsChanged: () => void
  onDragStart: (e: React.DragEvent<HTMLDivElement>, assetId: string) => void
  onDragEnd: () => void
}

// Moving a card TO either of these is admin-only - filtered out of the
// dropdown for editors, except when it's the card's own current status
// (so the select still renders correctly for a card already sitting there).
const RESTRICTED_STATUSES = ['revision', 'approved']

export function initialsFor(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'
}

export function BoardCard({ asset, color, isAdmin, token, editors, columns, onAssign, onStatusChange, onPriorityChange, onDelete, onVersionsChanged, onDragStart, onDragEnd }: BoardCardProps) {
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

  const isPlaceholder = !asset.mux_upload_id

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
      className={`group relative app-card p-3 cursor-pointer ${isPlaceholder ? 'border border-dashed border-th-faint' : 'border border-th-border'}`}
    >
      {!isPlaceholder && (
        <IconButton
          variant="delete"
          size="sm"
          label="Delete"
          onClick={(e) => { e.stopPropagation(); onDelete(asset.id) }}
          className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 z-20"
        >
          <Trash2 size={13} />
        </IconButton>
      )}

      <div className="flex items-center gap-2 mb-2">
        {isPlaceholder ? (
          <span
            className="w-5 h-5 rounded-th-sm border border-dashed border-th-faint flex items-center justify-center shrink-0 text-th-muted"
          >
            <Clock size={11} />
          </span>
        ) : (
          <span
            className="w-5 h-5 rounded-th-sm flex items-center justify-center shrink-0"
            style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
          >
            <Film accent size={11} style={{ color }} />
          </span>
        )}
        {isAdmin ? (
          <PriorityMenu
            value={asset.priority}
            onChange={(p) => onPriorityChange(asset.id, p)}
            size="sm"
          />
        ) : (
          <PriorityBadge size="sm" priority={asset.priority} />
        )}
        {!isPlaceholder && (
          <VersionBadge
            assetId={asset.id}
            versionCount={asset.version_count ?? 1}
            token={token}
            canManage
            onChanged={onVersionsChanged}
            label={`${asset.version_count} versions`}
            className="app-pill font-mono text-[10px] shrink-0 bg-th-surface-alt border border-th-border text-th-muted hover:text-th-text transition-colors"
          />
        )}
        {isPlaceholder ? (
          <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-th-muted">Awaiting upload</span>
        ) : asset.is_complete && (
          <span
            className="ml-auto w-4 h-4 rounded-full flex items-center justify-center shrink-0 ic-on-fill"
            style={{ background: 'var(--th-accent)', color: 'var(--th-accent-fg)', boxShadow: 'inset 0 0 0 1px var(--th-accent-edge)' }}
            title="Marked complete"
          >
            <ApproveIcon size={11} strokeWidth={2.5} />
          </span>
        )}
      </div>

      <p className="text-[13px] font-semibold leading-snug mb-0.5 line-clamp-2">{asset.name}</p>
      <p className="text-[11px] text-th-muted truncate mb-2">{asset.project_client}</p>

      {!isPlaceholder && (
        <select
          value={asset.pipeline_status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onStatusChange(asset.id, e.target.value) }}
          title="Change status"
          className="w-full mb-3 bg-th-surface-alt border border-th-border rounded-th-sm text-[11px] text-th-muted px-2 py-1 outline-none focus:border-th-accent-line font-mono cursor-pointer hover:text-th-text transition-colors"
        >
          {columns
            .filter((col) => isAdmin || col.key === asset.pipeline_status || !RESTRICTED_STATUSES.includes(col.key))
            .map((col) => (
              <option key={col.key} value={col.key}>{col.label}</option>
            ))}
        </select>
      )}

      <div className="flex items-center justify-between">
        {asset.editor ? (
          <div className="flex items-center gap-1.5 min-w-0" title={asset.editor.name}>
            <span
              className="app-avatar w-5 h-5 text-[9px]"
            >
              {initialsFor(asset.editor.name)}
            </span>
            <span className="text-[11px] text-th-muted truncate">{asset.editor.name}</span>
          </div>
        ) : (
          <span className="text-[11px] text-th-faint">Unassigned</span>
        )}

        {isAdmin && (
          <div className="relative shrink-0" ref={menuRef}>
            <IconButton
              label="Assign editor"
              size="sm"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
              className="gap-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              style={menuOpen ? { opacity: 1 } : undefined}
            >
              <UserPlus size={12} />
              <ChevronDown size={10} />
            </IconButton>

            {menuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 bottom-full mb-1 w-44 max-h-56 overflow-y-auto bg-th-surface border border-th-border rounded-th-sm shadow-panel z-20 py-1"
              >
                {editors.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-th-muted">No editors in workspace</p>
                ) : (
                  editors.map((ed) => (
                    <Button
                      key={ed.id}
                      variant="nav"
                      role="menuitem"
                      onClick={() => { onAssign(asset.id, ed.id); setMenuOpen(false) }}
                      className="gap-2 text-left text-[12px] [--btn-h:32px]"
                    >
                      <span
                        className="app-avatar w-4 h-4 text-[8px]"
                      >
                        {initialsFor(ed.name)}
                      </span>
                      <span className="truncate flex-1">{ed.name}</span>
                      {asset.editor?.id === ed.id && <Check size={12} />}
                    </Button>
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
