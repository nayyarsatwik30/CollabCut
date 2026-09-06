'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, LayoutGrid } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { BoardCard, type BoardAsset, type BoardEditorOption } from '@/components/board/BoardCard'
import { supabase } from '@/lib/supabase'

interface Column {
  key: string
  label: string
  color: string
}

const COLUMNS: Column[] = [
  { key: 'idea',      label: 'Idea',      color: 'var(--th-muted)' },
  { key: 'scripting', label: 'Scripting', color: 'var(--th-info)' },
  { key: 'filming',   label: 'Filming',   color: '#fbbf24' },
  { key: 'editing',   label: 'Editing',   color: 'var(--th-accent)' },
  { key: 'review',    label: 'Review',    color: 'var(--th-changes)' },
  { key: 'revision',  label: 'Revision',  color: '#fb923c' },
  { key: 'approved',  label: 'Approved',  color: 'var(--th-resolved)' },
]

export default function BoardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [token, setToken] = useState('')
  const [role, setRole] = useState<'admin' | 'editor' | null>(null)
  const [assets, setAssets] = useState<BoardAsset[]>([])
  const [editors, setEditors] = useState<BoardEditorOption[]>([])
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  useEffect(() => {
    loadBoard()
  }, [])

  const loadBoard = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }
    setToken(session.access_token)

    try {
      const res = await fetch('/api/board', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to load board')
        setLoading(false)
        return
      }

      setRole(data.role)
      setAssets(data.assets ?? [])

      if (data.role === 'admin') {
        const editorsRes = await fetch('/api/admin/editors', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const editorsData = await editorsRes.json()
        if (editorsRes.ok) setEditors(editorsData.editors ?? [])
      }
    } catch (err) {
      setError('Failed to load board')
    }
    setLoading(false)
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, assetId: string) => {
    e.dataTransfer.setData('text/plain', assetId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => setDragOverColumn(null)

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, columnKey: string) => {
    e.preventDefault()
    setDragOverColumn(null)
    const assetId = e.dataTransfer.getData('text/plain')
    if (!assetId) return

    const asset = assets.find((a) => a.id === assetId)
    if (!asset || asset.pipeline_status === columnKey) return

    const previousStatus = asset.pipeline_status
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, pipeline_status: columnKey } : a)))

    try {
      const res = await fetch(`/api/assets/${assetId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pipeline_status: columnKey }),
      })
      if (!res.ok) {
        setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, pipeline_status: previousStatus } : a)))
      }
    } catch (err) {
      setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, pipeline_status: previousStatus } : a)))
    }
  }

  const handleAssign = async (assetId: string, editorId: string) => {
    const asset = assets.find((a) => a.id === assetId)
    if (!asset) return
    const previousEditor = asset.editor
    const newEditor = editors.find((ed) => ed.id === editorId)
    if (!newEditor || previousEditor?.id === editorId) return

    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, editor: { id: newEditor.id, name: newEditor.name } } : a)))

    try {
      if (previousEditor) {
        await fetch(`/api/admin/editor/${previousEditor.id}/assets`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ assetId }),
        })
      }
      const res = await fetch(`/api/admin/editor/${editorId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assetId }),
      })
      if (!res.ok) {
        setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, editor: previousEditor } : a)))
      }
    } catch (err) {
      setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, editor: previousEditor } : a)))
    }
  }

  const grouped = useMemo(() => {
    const map: Record<string, BoardAsset[]> = {}
    for (const col of COLUMNS) map[col.key] = []
    for (const asset of assets) {
      const key = map[asset.pipeline_status] ? asset.pipeline_status : 'idea'
      map[key].push(asset)
    }
    return map
  }, [assets])

  const completeCount = assets.filter((a) => a.is_complete).length

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-th-bg">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <LayoutGrid size={15} style={{ color: 'var(--th-accent)' }} />
            <h1 className="text-[15px] font-bold">Board</h1>
          </div>
          <span className="font-mono text-[11px] text-th-muted">
            {role === 'editor' ? 'Showing assets assigned to you' : 'Showing all workspace assets'}
          </span>
        </div>

        {error ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-sm px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
              {error}
            </div>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="shrink-0 px-6 py-4 border-b border-th-border flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-th bg-th-surface border border-th-border">
                <span className="text-[15px] font-extrabold">{assets.length}</span>
                <span className="text-[11px] text-th-muted">total</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-th bg-th-surface border border-th-border">
                <Check size={12} style={{ color: 'var(--th-resolved)' }} />
                <span className="text-[15px] font-extrabold">{completeCount}</span>
                <span className="text-[11px] text-th-muted">complete</span>
              </div>
              <div className="w-px h-6 bg-th-border mx-1" />
              {COLUMNS.map((col) => (
                <div
                  key={col.key}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-th-full"
                  style={{ background: `color-mix(in srgb, ${col.color} 10%, transparent)` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: col.color }} />
                  <span className="text-[11px] font-medium" style={{ color: col.color }}>{col.label}</span>
                  <span className="font-mono text-[11px] text-th-muted">{grouped[col.key]?.length ?? 0}</span>
                </div>
              ))}
            </div>

            {/* Columns */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
              <div className="flex gap-4 h-full min-w-max">
                {COLUMNS.map((col) => (
                  <div
                    key={col.key}
                    onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.key) }}
                    onDragLeave={() => setDragOverColumn((c) => (c === col.key ? null : c))}
                    onDrop={(e) => handleDrop(e, col.key)}
                    className="w-[260px] shrink-0 flex flex-col rounded-th-lg border transition-colors"
                    style={{
                      background: dragOverColumn === col.key ? 'var(--th-surface-alt)' : 'transparent',
                      borderColor: dragOverColumn === col.key ? col.color : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-2 px-2 py-2 shrink-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col.color }} />
                      <span className="text-[12px] font-bold">{col.label}</span>
                      <span className="ml-auto font-mono text-[11px] text-th-muted">{grouped[col.key]?.length ?? 0}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto px-1 pb-2 space-y-2 min-h-[60px]">
                      {(grouped[col.key] ?? []).map((asset) => (
                        <BoardCard
                          key={asset.id}
                          asset={asset}
                          color={col.color}
                          isAdmin={role === 'admin'}
                          editors={editors}
                          onAssign={handleAssign}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                        />
                      ))}
                      {(grouped[col.key] ?? []).length === 0 && (
                        <div className="h-16 flex items-center justify-center text-[11px] text-th-faint border border-dashed border-th-border rounded-th">
                          No cards
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
