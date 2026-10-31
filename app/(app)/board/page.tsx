'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, Plus, FolderKanban, Users, ChevronLeft, Film } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BoardCard, initialsFor, type BoardAsset, type BoardEditorOption } from '@/components/board/BoardCard'
import { BoardSkeleton } from '@/components/board/BoardSkeleton'
import { NewContentModal } from '@/components/board/NewContentModal'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { Toast, useToast } from '@/components/ui/Toast'
import { ConfirmDialog, useConfirm } from '@/components/ui/ConfirmDialog'
import { useSessionGuard } from '@/lib/useSessionGuard'
import { usePolling, sameData } from '@/lib/usePolling'
import { priorityMeta } from '@/lib/priority'
import { ALL_CLIENTS_KEY, NO_CLIENT_KEY, buildClientTabs, clientKey, countLabel, mergeExtraClients, matchesClient, type ClientTab } from '@/lib/clients'
import { useSelectedClient } from '@/lib/useSelectedClient'
import { ClientTabStrip } from '@/components/board/ClientTabStrip'
import { Orb } from '@/components/ui/Orb'
import { Button, ButtonIcon } from '@/components/ui/Button'

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
  { key: 'idea',      label: 'Cut',          color: 'var(--th-muted)' },
  { key: 'editing',   label: 'Editing',      color: 'var(--th-accent-text)' },
  { key: 'review',    label: 'Review',       color: 'var(--th-changes)' },
  { key: 'revision',  label: 'Revision',     color: '#fb923c' },
  { key: 'approved',  label: 'Approved',     color: 'var(--th-resolved)' },
]

// Moving a card TO either of these is admin-only, regardless of which
// status it's currently in - mirrors the backend check in
// /api/assets/[id]/status so drag-and-drop can't bypass the dropdown's
// filtered options.
const RESTRICTED_TO_ADMIN = ['revision', 'approved']

export default function BoardPage() {
  const { session, ready } = useSessionGuard()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [token, setToken] = useState('')
  const [role, setRole] = useState<'admin' | 'editor' | null>(null)
  const [assets, setAssets] = useState<BoardAsset[]>([])
  const [editors, setEditors] = useState<BoardEditorOption[]>([])
  // Footer client tabs (admin only). A client is the projects.client label
  // inside this workspace (see lib/clients.ts); selecting one only filters
  // what is rendered, it never changes what the API returns.
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [showNewContent, setShowNewContent] = useState(false)

  const [workspaceId, setWorkspaceId] = useState('')
  // True once /api/board/projects has succeeded at least once: tab data is
  // only trustworthy (safe to reset a stored selection against) after that.
  const [projectsLoaded, setProjectsLoaded] = useState(false)
  const { selectedClient, setSelectedClient, extraClients, addClient, hydrated } = useSelectedClient(workspaceId)

  // Admin-only Projects/Editors views alongside the regular Kanban - gated
  // both by not rendering the tab bar for non-admins (below) and by the
  // /api/board/projects and /api/board/editor/[id]/assets endpoints
  // themselves rejecting non-admin requests server-side.
  const [boardView, setBoardView] = useState<BoardView>('board')
  const [projects, setProjects] = useState<WorkspaceProject[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  // Last fetch on entering/retrying the Projects view failed (shown instead of
  // the empty state when nothing is cached).
  const [projectsFailed, setProjectsFailed] = useState(false)
  const [projectsRetrying, setProjectsRetrying] = useState(false)
  // The Retry button stays mounted (aria-disabled, not unmounted) so focus stays on it.
  const retryProjects = async () => {
    if (projectsRetrying) return
    setProjectsRetrying(true)
    await fetchProjects(token)
    setProjectsRetrying(false)
  }

  // Every project fetch (initial load, poll, entering Projects) goes through
  // here: bounded by a timeout (covers the body read too) and stamped with a
  // generation so an older response can never overwrite a newer one.
  const projectsGenRef = useRef(0)
  // Workspace the board currently shows; project requests are tagged with it
  // and dropped if it changed while they were in flight.
  const workspaceRef = useRef('')
  const projectsInFlightRef = useRef(false)
  // Shared by loadBoard and polling: if /api/board resolves a different
  // workspace (multi-membership admin), drop the previous workspace's project
  // state and invalidate in-flight project requests before using the new data.
  const applyWorkspace = (id: string | undefined) => {
    if (!id) return
    if (workspaceRef.current && workspaceRef.current !== id) {
      projectsGenRef.current += 1
      projectsInFlightRef.current = false
      setProjects([])
      setProjectsLoaded(false)
      setProjectsFailed(false)
      setProjectsLoading(false)
    }
    workspaceRef.current = id
    setWorkspaceId(id)
  }
  const fetchProjects = async (accessToken: string, opts?: { skipIfBusy?: boolean }): Promise<'ok' | 'failed' | 'stale'> => {
    // Polls skip while a request is still out so a slow endpoint can't pile up
    // requests that each get superseded (starvation).
    if (opts?.skipIfBusy && projectsInFlightRef.current) return 'stale'
    const gen = ++projectsGenRef.current
    const issuedFor = workspaceRef.current
    projectsInFlightRef.current = true
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      // AbortController is missing on very old browsers: skip the timeout there.
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
      if (controller) timer = setTimeout(() => controller.abort(), 8000)
      const res = await fetch('/api/board/projects', {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller?.signal,
      })
      const data = await res.json()
      // Superseded / other-workspace responses are 'stale', not failures.
      if (gen !== projectsGenRef.current || issuedFor !== workspaceRef.current) return 'stale'
      if (!res.ok) { setProjectsFailed(true); return 'failed' }
      const next: WorkspaceProject[] = data.projects ?? []
      setProjects((prev) => (sameData(prev, next) ? prev : next))
      setProjectsLoaded(true)
      setProjectsFailed(false)
      return 'ok'
    } catch {
      // timeout / network: keep whatever we have
      if (gen !== projectsGenRef.current || issuedFor !== workspaceRef.current) return 'stale'
      setProjectsFailed(true)
      return 'failed'
    } finally {
      if (timer) clearTimeout(timer)
      if (gen === projectsGenRef.current) projectsInFlightRef.current = false
    }
  }
  const [selectedEditor, setSelectedEditor] = useState<BoardEditorOption | null>(null)
  const [editorAssets, setEditorAssets] = useState<BoardAsset[] | null>(null)
  const [editorAssetsLoading, setEditorAssetsLoading] = useState(false)

  const { toast, showToast, dismissToast } = useToast()
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()

  useEffect(() => {
    if (ready && session) loadBoard()
  }, [ready, session])

  const loadBoard = async () => {
    if (!session) return
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
      applyWorkspace(data.workspace_id)
      setAssets(data.assets ?? [])

      if (data.role === 'admin') {
        const editorsRes = await fetch('/api/board/editors', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const editorsData = await editorsRes.json()
        if (editorsRes.ok) setEditors(editorsData.editors ?? [])

        // Projects feed the client tabs so a client with no cards yet still
        // gets a tab. Best-effort: tabs fall back to the board's assets.
        // Not awaited: a slow/hung projects request must not hold the skeleton.
        void fetchProjects(session.access_token)
      }
    } catch (err) {
      setError('Failed to load board')
    }
    setLoading(false)
  }

  // Background refresh of the Kanban so another user's moves/new cards show
  // up without a reload. Never touches `loading` (no skeleton flash) and only
  // calls setAssets when the payload really changed. `mutationRef` guards
  // local optimistic edits: while one is in flight - or if one started while
  // this poll's request was out - the poll result is stale and gets dropped
  // instead of snapping the card back.
  const mutationRef = useRef({ pending: 0, generation: 0, dragging: false })
  const beginMutation = () => {
    mutationRef.current.pending += 1
    mutationRef.current.generation += 1
  }
  const endMutation = () => {
    mutationRef.current.pending -= 1
  }

  usePolling(async () => {
    const m = mutationRef.current
    if (m.pending > 0 || m.dragging) return
    const generation = m.generation
    const res = await fetch('/api/board', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const data = await res.json()
    if (m.pending > 0 || m.dragging || m.generation !== generation) return
    applyWorkspace(data.workspace_id)
    const next: BoardAsset[] = data.assets ?? []
    // /api/board has no ORDER BY, so compare order-insensitively - a mere
    // row reshuffle from Postgres isn't a change worth re-rendering for.
    const byId = (list: BoardAsset[]) => [...list].sort((a, b) => a.id.localeCompare(b.id))
    setAssets((prev) => (sameData(byId(prev), byId(next)) ? prev : next))

    // Keep project-derived client tabs fresh too. Not awaited: a slow
    // projects request must never delay the board's own polling cadence.
    if (role === 'admin') void fetchProjects(token, { skipIfBusy: true })
  }, 3000, !loading && !error && boardView === 'board')

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, assetId: string) => {
    mutationRef.current.dragging = true
    e.dataTransfer.setData('text/plain', assetId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    mutationRef.current.dragging = false
    setDragOverColumn(null)
  }

  // Single source of truth for changing an asset's column - both drag-and-drop
  // and the card's inline status dropdown call this same function, so there's
  // exactly one code path that ever PATCHes pipeline_status.
  const updateAssetStatus = async (assetId: string, columnKey: string) => {
    const asset = assets.find((a) => a.id === assetId)
    if (!asset || asset.pipeline_status === columnKey) return

    if (role === 'editor' && RESTRICTED_TO_ADMIN.includes(columnKey)) {
      showToast('Only an admin can move a cut to that status.', 'error')
      return
    }

    const previousStatus = asset.pipeline_status
    const previousComplete = asset.is_complete
    // pipeline_status and is_complete are kept in lockstep server-side, so
    // mirror that here for an immediate badge update instead of waiting on
    // a refetch.
    const nextComplete = columnKey === 'approved'
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, pipeline_status: columnKey, is_complete: nextComplete } : a)))

    beginMutation()
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
    } finally {
      endMutation()
    }
  }

  // Priority is admin-only to change (editors only ever see the read-only
  // badge), kept in sync server-side across every version in the lineage -
  // see PATCH /api/assets/[id]/priority.
  const updatePriority = async (assetId: string, priority: number) => {
    const asset = assets.find((a) => a.id === assetId)
    if (!asset || asset.priority === priority) return

    const previousPriority = asset.priority
    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, priority } : a)))

    beginMutation()
    try {
      const res = await fetch(`/api/assets/${assetId}/priority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priority }),
      })
      if (!res.ok) {
        setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, priority: previousPriority } : a)))
        showToast('Failed to update priority.', 'error')
      }
    } catch (err) {
      setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, priority: previousPriority } : a)))
      showToast('Failed to update priority.', 'error')
    } finally {
      endMutation()
    }
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, columnKey: string) => {
    e.preventDefault()
    setDragOverColumn(null)
    // A successful drop moves the card to another column, which unmounts the
    // dragged element - and a removed element never fires dragend. Clear the
    // flag here too, or polling stays paused until the next reload.
    mutationRef.current.dragging = false
    const assetId = e.dataTransfer.getData('text/plain')
    if (!assetId) return
    await updateAssetStatus(assetId, columnKey)
  }

  const handleDeleteAsset = async (assetId: string) => {
    const versionCount = assets.find((a) => a.id === assetId)?.version_count ?? 1
    const ok = await confirm({
      title: versionCount > 1 ? `Delete this cut and all ${versionCount} versions?` : 'Delete this cut?',
      message: versionCount > 1
        ? 'Every version will be moved to the Recycle Bin, where each can be restored individually.'
        : 'It will be moved to the Recycle Bin.',
      confirmLabel: 'Delete',
    })
    if (!ok) return

    const previousAssets = assets
    setAssets((prev) => prev.filter((a) => a.id !== assetId))

    beginMutation()
    try {
      const res = await fetch(`/api/assets/${assetId}/delete?scope=group`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        setAssets(previousAssets)
        showToast('Failed to delete cut.', 'error')
      }
    } catch (err) {
      setAssets(previousAssets)
      showToast('Failed to delete cut.', 'error')
    } finally {
      endMutation()
    }
  }

  // Pull fresh data after a version is deleted from the card's version manager,
  // so the badge count (and the latest version the card shows) update at once.
  const refreshBoard = async () => {
    const res = await fetch('/api/board', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const data = await res.json()
    setAssets(data.assets ?? [])
  }

  const handleAssign = async (assetId: string, editorId: string) => {
    const asset = assets.find((a) => a.id === assetId)
    if (!asset) return
    const previousEditor = asset.editor
    const newEditor = editors.find((ed) => ed.id === editorId)
    if (!newEditor || previousEditor?.id === editorId) return

    setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, editor: { id: newEditor.id, name: newEditor.name } } : a)))

    beginMutation()
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
    } finally {
      endMutation()
    }
  }

  const handleBoardViewChange = async (view: BoardView) => {
    setBoardView(view)
    setSelectedEditor(null)
    setEditorAssets(null)

    if (view === 'projects') {
      // Always refetch on entry so the grid and client tabs are never stale;
      // only show the spinner when there is nothing to show yet.
      setProjectsLoading(projects.length === 0)
      const result = await fetchProjects(token)
      if (result !== 'stale') setProjectsLoading(false)
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

  const clientTabs = useMemo<ClientTab[]>(() => {
    if (role !== 'admin') return []
    const tabs = buildClientTabs(assets.map((a) => ({ client: a.project_client })))
    const known = new Set(tabs.map((t) => t.key))
    for (const t of buildClientTabs(projects.map((p) => ({ client: p.client })))) {
      if (!known.has(t.key)) { tabs.push({ ...t, count: 0 }); known.add(t.key) }
    }
    return mergeExtraClients(tabs, extraClients)
  }, [role, assets, projects, extraClients])

  // A tab can vanish (last card moved/deleted); fall back to All rather than
  // showing an empty board for a client that no longer exists.
  // Until the tab data is trustworthy (selection restored + projects fetched),
  // keep the stored selection active instead of flashing back to All, and
  // hold off creating content so New can't open with the wrong client.
  const tabsReady = hydrated && projectsLoaded
  // Reveal the strip only once both tab sources have loaded (or after the same
  // 8s bound the project fetch uses) so a project-only tab can't appear late
  // and reorder it after first paint.
  const [stripBound, setStripBound] = useState(false)
  useEffect(() => {
    if (role !== 'admin') return
    const t = setTimeout(() => setStripBound(true), 8000)
    return () => clearTimeout(t)
  }, [role])
  const stripReady = tabsReady || stripBound
  const clientPending = role === 'admin' && !tabsReady && selectedClient !== ALL_CLIENTS_KEY
    && !clientTabs.some((t) => t.key === selectedClient)
  const activeClient = clientPending || clientTabs.some((t) => t.key === selectedClient) ? selectedClient : ALL_CLIENTS_KEY
  const showClientCtx = role === 'admin' && boardView !== 'editors'

  // Actually reset (not just display All) so a stale key can't silently
  // reselect if a client with that name reappears later (also when the last
  // client disappears). Waits for the initial load to finish.
  useEffect(() => {
    if (tabsReady && !loading && role === 'admin' && selectedClient !== ALL_CLIENTS_KEY && activeClient === ALL_CLIENTS_KEY) {
      setSelectedClient(ALL_CLIENTS_KEY)
    }
  }, [tabsReady, loading, role, selectedClient, activeClient, setSelectedClient])

  const visibleAssets = useMemo(
    () => (role === 'admin' ? assets.filter((a) => matchesClient(a.project_client, activeClient)) : assets),
    [role, assets, activeClient]
  )
  // Tab counts follow the active view so a tab never promises more (or fewer)
  // items than the grid/board beneath it shows.
  const tabCount = (key: string) =>
    boardView === 'projects'
      ? projects.filter((p) => matchesClient(p.client, key)).length
      : key === ALL_CLIENTS_KEY ? assets.length : (clientTabs.find((t) => t.key === key)?.count ?? 0)
  const activeClientLabel = clientTabs.find((t) => t.key === activeClient)?.label
    ?? assets.find((a) => clientKey(a.project_client) === activeClient)?.project_client?.trim()
    ?? ''
  // Default client for New Content: the selected tab (not All / No client).
  const defaultClient = activeClient === ALL_CLIENTS_KEY || activeClient === NO_CLIENT_KEY ? '' : activeClientLabel

  const visibleProjects = useMemo(
    () => projects.filter((p) => matchesClient(p.client, activeClient)),
    [projects, activeClient]
  )

  const grouped = useMemo(() => {
    const map: Record<string, BoardAsset[]> = {}
    for (const col of COLUMNS) map[col.key] = []
    for (const asset of visibleAssets) {
      const key = map[asset.pipeline_status] ? asset.pipeline_status : 'idea'
      map[key].push(asset)
    }
    // P1 first, P3 last. /api/board still has no ORDER BY (see the polling
    // comment above) - this sort is purely client-side, same as the grouping itself.
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.priority - b.priority)
    }
    return map
  }, [visibleAssets])

  const boardTitleClient = activeClient === NO_CLIENT_KEY ? 'No client' : activeClientLabel
  const countsUnavailable = boardView === 'projects' && projectsFailed && projects.length === 0
  const ctxText = role === 'editor'
    ? 'Showing assets assigned to you'
    : boardView === 'editors'
      ? 'Showing all workspace editors'
      : `Showing ${boardView === 'projects' ? (countsUnavailable ? 'projects (count unavailable)' : countLabel(visibleProjects.length, 'projects')) : countLabel(visibleAssets.length, 'cards')}${activeClient === ALL_CLIENTS_KEY ? ' (all clients)' : ''}`

  if (loading) {
    return (
      <>
        <BoardSkeleton />
      </>
    )
  }

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar title={showClientCtx && activeClient !== ALL_CLIENTS_KEY ? `Board: ${boardTitleClient}` : 'Board'} icon={LayoutGrid}>
          <span className="font-mono text-[11px] text-th-muted hidden md:inline">{ctxText}</span>
          {showClientCtx && activeClient !== ALL_CLIENTS_KEY && (
            <Button onClick={() => setSelectedClient(ALL_CLIENTS_KEY)} size="sm" variant="secondary" className="hidden md:inline-flex">Show all clients</Button>
          )}
          {role === 'admin' && (
            <Button onClick={() => setShowNewContent(true)} size="sm" disabled={clientPending}>
              <Plus size={13} /> New
            </Button>
          )}
        </TopBar>
        {/* Narrow screens: the count text and "Show all clients" move out of the
            top bar (which would squeeze the title to nothing) onto their own line. */}
        <div className="md:hidden shrink-0 px-4 py-2 border-b border-th-border flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-th-muted">
          <span className="min-w-0 break-words">{ctxText}</span>
          {showClientCtx && activeClient !== ALL_CLIENTS_KEY && (
            <Button onClick={() => setSelectedClient(ALL_CLIENTS_KEY)} size="sm" variant="secondary">Show all clients</Button>
          )}
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
                  color: boardView === key ? 'var(--th-accent-text)' : 'var(--th-muted)',
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
            {projectsFailed && (
              <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-[13px] text-th-changes">
                Couldn&apos;t load projects. Check your connection and try again.
                <Button onClick={retryProjects} size="sm" variant="secondary" aria-busy={projectsRetrying} aria-disabled={projectsRetrying}>
                  {projectsRetrying ? 'Retrying...' : 'Retry'}
                </Button>
              </div>
            )}
            {projectsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Orb state="composing" size={64} label="Loading" />
              </div>
            ) : visibleProjects.length === 0 && projectsFailed ? null : visibleProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                <FolderKanban size={32} className="text-th-faint" />
                <p className="text-[13px] text-th-muted">
                  {activeClient === ALL_CLIENTS_KEY
                    ? 'No projects in this workspace yet.'
                    : activeClient === NO_CLIENT_KEY ? 'No projects without a client.' : `No projects for ${activeClientLabel} yet`}
                </p>
                <Button onClick={() => setShowNewContent(true)} size="sm" disabled={clientPending}><Plus size={13} /> New{defaultClient ? ` for ${defaultClient}` : ''}</Button>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {visibleProjects.map((p) => (
                  <ProjectCard key={p.id} project={{ ...p, client: p.client ?? '' }} view="grid" />
                ))}
              </div>
            )}
          </div>
        ) : boardView === 'editors' ? (
          <div className="flex-1 overflow-y-auto p-6">
            {selectedEditor ? (
              <div>
                <Button
                  onClick={() => { setSelectedEditor(null); setEditorAssets(null) }}
                  variant="secondary" size="sm" className="mb-4"
                >
                  <ButtonIcon className="group-hover:-translate-x-0.5 group-hover:translate-y-0 group-active:-translate-x-1">
                    <ChevronLeft size={13} />
                  </ButtonIcon> All editors
                </Button>
                <div className="flex items-center gap-2.5 mb-4">
                  <span
                    className="app-avatar w-8 h-8 text-[11px]"
                    
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
                    <Orb state="composing" size={64} label="Loading" />
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
                          <p className="text-[11px] text-th-muted truncate mb-2.5">{a.project_client}</p>
                          <span
                            className="app-pill w-fit text-[10px]"
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
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                {editors.map((ed) => {
                  const preview = ed.cutsPreview ?? []
                  const moreCount = (ed.assetCount ?? 0) - preview.length
                  return (
                    <button
                      key={ed.id}
                      onClick={() => handleSelectEditor(ed)}
                      className="flex flex-col gap-3 text-left bg-th-surface border border-th-border rounded-th-lg p-4 hover:border-th-accent transition-colors shadow-card hover:shadow-card-hover btn-press"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="app-avatar w-9 h-9 text-[12px]"
                          
                        >
                          {initialsFor(ed.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold truncate">{ed.name}</p>
                          <p className="font-mono text-[10px] text-th-muted">{ed.assetCount ?? 0} active</p>
                        </div>
                      </div>

                      {preview.length === 0 ? (
                        <p className="text-[11px] text-th-faint">No active cuts</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {preview.map((cut) => {
                            const col = COLUMNS.find((c) => c.key === cut.status) ?? COLUMNS[0]
                            return (
                              <div key={cut.id} className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className="app-pill shrink-0 font-mono text-[10px]"
                                  style={{ color: priorityMeta(cut.priority).color, background: `color-mix(in srgb, ${priorityMeta(cut.priority).color} 16%, transparent)` }}
                                >
                                  {priorityMeta(cut.priority).label}
                                </span>
                                <span className="text-[11px] text-th-text truncate flex-1">{cut.title}</span>
                                <span
                                  className="app-pill shrink-0 text-[10px]"
                                  style={{ color: col.color, background: `color-mix(in srgb, ${col.color} 14%, transparent)` }}
                                >
                                  {col.label}
                                </span>
                              </div>
                            )
                          })}
                          {moreCount > 0 && (
                            <p className="text-[10px] text-th-muted pl-2.5">+{moreCount} more</p>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="shrink-0 px-6 py-4 border-b border-th-border">
              <div
                className="inline-flex items-center flex-wrap max-w-full"
                style={{
                  padding: 6,
                  // Recessed strip: a hair off the page colour, no shadow.
                  background: 'color-mix(in srgb, var(--th-text) 3%, var(--th-bg))',
                  border: '1px solid var(--th-border)',
                  borderRadius: 16,
                }}
              >
                <div className="flex items-center" style={{ gap: 8, padding: '9px 16px' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--th-text)' }}>{visibleAssets.length}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--th-muted)' }}>{visibleAssets.length === 1 ? 'card' : 'cards'} total</span>
                </div>
                <div style={{ width: 1, height: 20, background: 'var(--th-border)', margin: '0 2px' }} />
                {COLUMNS.map((col) => (
                  <div
                    key={col.key}
                    className="inline-flex items-center"
                    style={{
                      gap: 7,
                      padding: '8px 14px',
                      borderRadius: 11,
                      border: '1px solid transparent',
                      background: 'transparent',
                      color: 'var(--th-muted)',
                      transition: 'background-color 160ms ease, color 160ms ease, border-color 160ms ease',
                    }}
                  >
                    <span className="shrink-0" style={{ width: 7, height: 7, borderRadius: '50%', background: col.color }} />
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{col.label}</span>
                    <span style={{ fontFamily: 'var(--th-mono)', fontSize: 11, opacity: 0.75 }}>{grouped[col.key]?.length ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>

            {activeClient !== ALL_CLIENTS_KEY && visibleAssets.length === 0 && (
              <div className="shrink-0 mx-6 mt-4 flex items-center gap-3 px-4 py-3 rounded-th border border-dashed border-th-border text-[12px] text-th-muted">
                <span>{activeClient === NO_CLIENT_KEY ? 'No cards without a client.' : `No cards for ${activeClientLabel} yet`}</span>
                <Button onClick={() => setShowNewContent(true)} size="sm" disabled={clientPending}><Plus size={13} /> New{defaultClient ? ` for ${defaultClient}` : ''}</Button>
              </div>
            )}

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
                          token={token}
                          editors={editors}
                          columns={COLUMNS}
                          onAssign={handleAssign}
                          onStatusChange={updateAssetStatus}
                          onPriorityChange={updatePriority}
                          onDelete={handleDeleteAsset}
                          onVersionsChanged={refreshBoard}
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

        {role === 'admin' && !error && boardView !== 'editors' && !stripReady && (
          <div aria-hidden className="shrink-0 h-9 bg-th-surface border-t border-th-border" />
        )}
        {role === 'admin' && !error && boardView !== 'editors' && stripReady && (
          <ClientTabStrip
            tabs={clientTabs}
            allCount={tabCount(ALL_CLIENTS_KEY)}
            countFor={tabCount}
            activeKey={activeClient}
            onSelect={setSelectedClient}
            onAdd={(name) => addClient(name, clientTabs.map((t) => t.key))}
            unit={boardView === 'projects' ? 'projects' : 'cards'}
            countsUnavailable={countsUnavailable}
          />
        )}
      </div>

      <Toast toast={toast} onDismiss={dismissToast} />
      <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />

      {showNewContent && (
        <NewContentModal
          defaultClient={defaultClient}
          onClose={() => setShowNewContent(false)}
          onCreated={() => {
            setShowNewContent(false)
            showToast('New content created!', 'success')
            loadBoard()
          }}
        />
      )}
    </>
  )
}
