'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutGrid, Plus, FolderKanban, Users, ChevronLeft, Film, LogOut } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { BoardCard, initialsFor, type BoardAsset, type BoardEditorOption } from '@/components/board/BoardCard'
import { NewContentModal } from '@/components/board/NewContentModal'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { Toast, useToast } from '@/components/ui/Toast'
import { ConfirmDialog, useConfirm } from '@/components/ui/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { performLogout } from '@/lib/auth'

type BoardView = 'board' | 'projects' | 'editors'

interface WorkspaceProject {
  id: string
  name: string
  client: string
  status: string
  emoji?: string
}

interface Column {
  key: string
  label: string
  color: string
}

const COLUMNS: Column[] = [
  { key: 'idea',      label: 'Assigned Cut', color: 'var(--th-muted)' },
  { key: 'editing',   label: 'Editing',      color: 'var(--th-accent)' },
  { key: 'review',    label: 'Review',       color: 'var(--th-changes)' },
  { key: 'revision',  label: 'Revision',     color: '#fb923c' },
  { key: 'approved',  label: 'Approved',     color: 'var(--th-resolved)' },
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
  const [showNewContent, setShowNewContent] = useState(false)

  // Admin-only Projects/Editors views alongside the regular Kanban - gated
  // both by not rendering the tab bar for non-admins (below) and by the
  // /api/board/projects and /api/board/editor/[id]/assets endpoints
  // themselves rejecting non-admin requests server-side.
  const [boardView, setBoardView] = useState<BoardView>('board')
  const [projects, setProjects] = useState<WorkspaceProject[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [selectedEditor, setSelectedEditor] = useState<BoardEditorOption | null>(null)
  const [editorAssets, setEditorAssets] = useState<BoardAsset[] | null>(null)
  const [editorAssetsLoading, setEditorAssetsLoading] = useState(false)

  const { toast, showToast, dismissToast } = useToast()
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()

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
        const editorsRes = await fetch('/api/board/editors', {
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

  const handleLogout = async () => {
    await performLogout(router)
  }

  const handleLogoutClick = async () => {
    const ok = await confirm({ title: 'Log out of CollabCut?', confirmLabel: 'Yes, log out' })
    if (ok) handleLogout()
  }

  // Single source of truth for changing an asset's column - both drag-and-drop
  // and the card's inline status dropdown call this same function, so there's
  // exactly one code path that ever PATCHes pipeline_status.
  const updateAssetStatus = async (assetId: string, columnKey: string) => {
    const asset = assets.find((a) => a.id === assetId)
    if (!asset || asset.pipeline_status === columnKey) return

    const previousStatus = asset.pipeline_status
    const previousComplete = asset.is_complete
    // pipeline_status and is_complete are kept in lockstep server-side, so
    // mirror that here for an immediate badge update instead of waiting on
    // a refetch.
    const nextComplete = columnKey === 'approved'
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, pipeline_status: columnKey, is_complete: nextComplete } : a)))

    try {
      const res = await fetch(`/api/assets/${assetId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pipeline_status: columnKey }),
      })
      if (!res.ok) {
        setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, pipeline_status: previousStatus, is_complete: previousComplete } : a)))
      }
    } catch (err) {
      setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, pipeline_status: previousStatus, is_complete: previousComplete } : a)))
    }
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, columnKey: string) => {
    e.preventDefault()
    setDragOverColumn(null)
    const assetId = e.dataTransfer.getData('text/plain')
    if (!assetId) return
    await updateAssetStatus(assetId, columnKey)
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
        await fetch(`/api/board/editor/${previousEditor.id}/assets`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ assetId }),
        })
      }
      const res = await fetch(`/api/board/editor/${editorId}/assets`, {
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

  const handleBoardViewChange = async (view: BoardView) => {
    setBoardView(view)
    setSelectedEditor(null)
    setEditorAssets(null)

    if (view === 'projects' && projects.length === 0) {
      setProjectsLoading(true)
      try {
        const res = await fetch('/api/board/projects', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok) setProjects(data.projects ?? [])
      } catch (err) {
        // leave projects empty - the grid will just show nothing to pick
      }
      setProjectsLoading(false)
    }
  }

  const handleSelectEditor = async (editor: BoardEditorOption) => {
    setSelectedEditor(editor)
    setEditorAssets(null)
    setEditorAssetsLoading(true)
    try {
      const res = await fetch(`/api/board/editor/${editor.id}/assets`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setEditorAssets(data.assets ?? [])
    } catch (err) {
      setEditorAssets([])
    }
    setEditorAssetsLoading(false)
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
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-th-muted">
              {role === 'editor' ? 'Showing assets assigned to you' : 'Showing all workspace assets'}
            </span>
            {role === 'admin' && (
              <button
                onClick={() => setShowNewContent(true)}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity"
              >
                <Plus size={13} /> New
              </button>
            )}
            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-1.5 h-8 px-3 rounded-th bg-th-surface-alt border border-th-border text-[13px] text-th-muted btn-press hover:text-th-changes transition-colors"
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>

        {role === 'admin' && (
          <div className="shrink-0 bg-th-surface border-b border-th-border px-6 flex gap-1">
            {([
              { key: 'board', icon: LayoutGrid, label: 'Board' },
              { key: 'projects', icon: FolderKanban, label: 'Projects' },
              { key: 'editors', icon: Users, label: 'Editors' },
            ] as { key: BoardView; icon: React.ElementType; label: string }[]).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => handleBoardViewChange(key)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] border-b-2 btn-press transition-colors"
                style={{
                  color: boardView === key ? 'var(--th-accent)' : 'var(--th-muted)',
                  borderColor: boardView === key ? 'var(--th-accent)' : 'transparent',
                  fontWeight: boardView === key ? 700 : 400,
                }}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        )}

        {error ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-sm px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
              {error}
            </div>
          </div>
        ) : boardView === 'projects' ? (
          <div className="flex-1 overflow-y-auto p-6">
            {projectsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <FolderKanban size={32} className="text-th-faint" />
                <p className="text-[13px] text-th-muted">No projects in this workspace yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {projects.map((p) => (
                  <ProjectCard key={p.id} project={{ ...p, client: p.client ?? '' }} view="grid" />
                ))}
              </div>
            )}
          </div>
        ) : boardView === 'editors' ? (
          <div className="flex-1 overflow-y-auto p-6">
            {selectedEditor ? (
              <div>
                <button
                  onClick={() => { setSelectedEditor(null); setEditorAssets(null) }}
                  className="flex items-center gap-1.5 mb-4 h-8 px-3 rounded-th bg-th-surface-alt border border-th-border text-[12px] text-th-muted hover:text-th-text transition-colors btn-press"
                >
                  <ChevronLeft size={13} /> All editors
                </button>
                <div className="flex items-center gap-2.5 mb-4">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0"
                    style={{ background: '#22D3EE', color: '#000' }}
                  >
                    {initialsFor(selectedEditor.name)}
                  </span>
                  <div>
                    <p className="text-[14px] font-bold">{selectedEditor.name}</p>
                    <p className="text-[11px] text-th-muted">{editorAssets?.length ?? 0} assigned assets</p>
                  </div>
                </div>

                {editorAssetsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
                  </div>
                ) : !editorAssets || editorAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                    <Film size={32} className="text-th-faint" />
                    <p className="text-[13px] text-th-muted">No assets assigned to this editor.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                    {editorAssets.map((a) => {
                      const col = COLUMNS.find((c) => c.key === a.pipeline_status) ?? COLUMNS[0]
                      return (
                        <Link
                          key={a.id}
                          href={`/review/${a.id}`}
                          className="flex flex-col bg-th-surface border border-th-border rounded-th-lg p-3.5 hover:border-th-accent transition-colors shadow-card hover:shadow-card-hover"
                        >
                          <p className="text-[13px] font-semibold leading-snug mb-0.5 line-clamp-2">{a.name}</p>
                          <p className="text-[11px] text-th-muted truncate mb-2.5">{a.project_name}</p>
                          <span
                            className="w-fit text-[10px] font-medium px-2 py-0.5 rounded-th-full"
                            style={{ color: col.color, background: `color-mix(in srgb, ${col.color} 14%, transparent)` }}
                          >
                            {col.label}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : editors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <Users size={32} className="text-th-faint" />
                <p className="text-[13px] text-th-muted">No editors in this workspace yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {editors.map((ed) => (
                  <button
                    key={ed.id}
                    onClick={() => handleSelectEditor(ed)}
                    className="flex flex-col items-center text-center gap-2.5 bg-th-surface border border-th-border rounded-th-lg p-5 hover:border-th-accent transition-colors shadow-card hover:shadow-card-hover btn-press"
                  >
                    <span
                      className="w-11 h-11 rounded-full flex items-center justify-center text-[13px] font-extrabold shrink-0"
                      style={{ background: '#22D3EE', color: '#000' }}
                    >
                      {initialsFor(ed.name)}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold truncate">{ed.name}</p>
                      <p className="font-mono text-[10px] text-th-muted">{ed.assetCount ?? 0} assigned</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="shrink-0 px-6 py-4 border-b border-th-border flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-th bg-th-surface border border-th-border">
                <span className="text-[15px] font-extrabold">{assets.length}</span>
                <span className="text-[11px] text-th-muted">total</span>
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
                          columns={COLUMNS}
                          onAssign={handleAssign}
                          onStatusChange={updateAssetStatus}
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

      <Toast toast={toast} onDismiss={dismissToast} />
      <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />

      {showNewContent && (
        <NewContentModal
          onClose={() => setShowNewContent(false)}
          onCreated={() => {
            setShowNewContent(false)
            showToast('New content created!', 'success')
            loadBoard()
          }}
        />
      )}
    </div>
  )
}
