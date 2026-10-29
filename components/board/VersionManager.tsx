'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Layers, Trash2 } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { useConfirm, ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface VersionRow {
  id: string
  version: number
  created_at: string
  size_bytes: number | null
}

interface VersionBadgeProps {
  assetId: string
  versionCount: number
  token: string | null
  // Server re-checks admin / assigned editor on every delete; this only
  // decides whether the trash icons render.
  canManage: boolean
  onChanged: () => void
  // Chip text and styling differ per surface (board card vs. thumbnail overlay).
  label: string
  className?: string
}

// Clickable "N versions" chip that opens a version manager popover. Renders
// nothing for a single-version asset. The popover is portaled to <body> so it
// isn't clipped by the card's overflow-hidden, and swallows click/drag events
// so it never triggers the card's own navigation.
export function VersionBadge({ assetId, versionCount, token, canManage, onChanged, label, className }: VersionBadgeProps) {
  const router = useRouter()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [versions, setVersions] = useState<VersionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined

  const load = useCallback(async () => {
    setError(null)
    setLoadFailed(false)
    try {
      const res = await fetch(`/api/assets/${assetId}/versions`, { headers: authHeaders })
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setVersions(data.versions ?? [])
    } catch {
      setLoadFailed(true)
      setError('Could not load versions.')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, token])

  useEffect(() => {
    if (!open) return
    load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (versionCount < 2) return null

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const width = 240
      setPos({
        top: rect.bottom + 6,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      })
    }
    setOpen((v) => !v)
  }

  // Mirrors the server guards: the origin (lowest) version can't go while
  // later ones exist, and the last remaining version can't be deleted here.
  const originId = versions?.reduce<VersionRow | null>((min, v) => (!min || v.version < min.version ? v : min), null)?.id

  const handleDelete = async (v: VersionRow) => {
    const ok = await confirm({
      title: `Delete v${v.version}?`,
      message: 'It will be moved to the Recycle Bin.',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    setBusyId(v.id)
    setError(null)
    try {
      const res = await fetch(`/api/assets/${v.id}/delete?scope=version`, { method: 'POST', headers: authHeaders })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? `Failed to delete v${v.version}`)
        return
      }
      setOpen(false)
      onChanged()
    } catch {
      setError(`Failed to delete v${v.version}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        onMouseDown={(e) => e.stopPropagation()}
        title="Manage versions"
        className={className}
      >
        <Layers size={10} />
        {label}
      </button>

      {open && pos && createPortal(
        <div
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[41] w-60 bg-th-surface border border-th-border rounded-th-lg shadow-panel overflow-hidden"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="px-4 py-2.5 border-b border-th-border font-mono text-[10px] text-th-muted uppercase tracking-wider">
              Versions
            </div>
            <div className="max-h-60 overflow-y-auto">
              {versions === null ? (
                loadFailed ? (
                  <button type="button" onClick={load} className="px-4 py-3 text-[11px] text-th-muted underline btn-press">
                    Try again
                  </button>
                ) : (
                  <p className="px-4 py-3 text-[11px] text-th-muted">Loading…</p>
                )
              ) : versions.map((v) => {
                const canDelete = canManage && versions.length > 1 && v.id !== originId
                return (
                  <div key={v.id} className="flex items-center border-b border-th-border last:border-b-0 hover:bg-th-surface-alt transition-colors">
                    <button
                      type="button"
                      onClick={() => router.push(`/review/${v.id}`)}
                      className="flex-1 min-w-0 flex items-center gap-2.5 pl-4 pr-2 py-3 text-left btn-press"
                    >
                      <Layers size={12} className="text-th-muted shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate">v{v.version}</p>
                        <p className="font-mono text-[10px] text-th-muted">{new Date(v.created_at).toLocaleDateString()}</p>
                      </div>
                    </button>
                    {canDelete ? (
                      <IconButton
                        onClick={() => handleDelete(v)}
                        disabled={busyId === v.id}
                        label={`Delete v${v.version}`}
                        size="sm" variant="ghost" className="mr-2"
                      >
                        <Trash2 size={12} />
                      </IconButton>
                    ) : (
                      <div className="w-7 mr-2 shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
            {error && <p className="px-4 py-2 text-[11px] border-t border-th-border" style={{ color: 'var(--th-changes)' }}>{error}</p>}
          </div>
        </div>,
        document.body
      )}

      {/* Dialog clicks bubble through the React tree to the card; keep them from navigating. */}
      <div onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
        <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
      </div>
    </>
  )
}
