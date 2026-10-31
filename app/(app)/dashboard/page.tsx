'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Search, LayoutGrid, List, Plus, Upload, Film, Check, FolderKanban } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { CardGridSkeleton } from '@/components/ui/CardGridSkeleton'
import { ConfirmDialog, useConfirm } from '@/components/ui/ConfirmDialog'
import { NewContentModal } from '@/components/board/NewContentModal'
import { useSessionGuard } from '@/lib/useSessionGuard'
import { ALL_CLIENTS_KEY, NO_CLIENT_KEY, buildClientTabs, countLabel, mergeExtraClients, matchesClient, type ClientTab } from '@/lib/clients'
import { useSelectedClient } from '@/lib/useSelectedClient'
import { ClientTabStrip } from '@/components/board/ClientTabStrip'
import { priorityMeta } from '@/lib/priority'
import type { Project } from '@/lib/types'

interface AssignedAsset {
  id: string
  name: string
  status: string
  is_complete: boolean
  mux_playback_id: string | null
  project_id: string | null
  project_name: string
  project_client: string
  priority: number
}

const STATUS_COLOR: Record<string, string> = {
  in_review: 'var(--th-open)',
  approved: 'var(--th-resolved)',
  changes: 'var(--th-changes)',
  processing: 'var(--th-muted)',
}

const STATUS_LABEL: Record<string, string> = {
  in_review: 'IN REVIEW',
  approved: 'APPROVED',
  changes: 'NEEDS CHANGES',
  processing: 'PROCESSING',
}

export default function DashboardPage() {
  const { session, ready } = useSessionGuard()
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [role, setRole] = useState<'admin' | 'editor' | null>(null)
  const [assignedAssets, setAssignedAssets] = useState<AssignedAsset[]>([])
  const [authError, setAuthError] = useState('')
  const [dashTab, setDashTab] = useState<'assigned' | 'projects'>('assigned')
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [myProjectsLoading, setMyProjectsLoading] = useState(false)
  // Same client selection as the Board page (shared per-workspace session
  // state); admins only. Editors keep the unfiltered view.
  const [workspaceId, setWorkspaceId] = useState('')
  const [wsLookupFailed, setWsLookupFailed] = useState(false)
  const { selectedClient, setSelectedClient, extraClients, addClient, hydrated } = useSelectedClient(workspaceId)

  useEffect(() => {
    if (ready && session) checkAuthAndLoad()
  }, [ready, session])

  const checkAuthAndLoad = async () => {
    if (!session) return
    setToken(session.access_token)

    let roles: string[]
    try {
      const res = await fetch('/api/me/role')
      if (!res.ok) throw new Error('role fetch failed')
      const data = await res.json()
      roles = data.roles ?? []
    } catch {
      // Never redirect off a failed role check - show an error instead of
      // silently rendering the wrong view.
      setAuthError('Failed to verify your workspace role. Please refresh and try again.')
      setLoading(false)
      return
    }

    const currentRole = roles.includes('admin') ? 'admin' : roles.includes('editor') ? 'editor' : null
    setRole(currentRole)

    if (currentRole === 'editor') {
      loadAssignedAssets(session.access_token)
    } else {
      loadProjects(session.access_token, { initial: true })
      // Workspace id only keys the client-selection storage; best-effort.
      try {
        // Bounded without AbortController: a hung lookup falls back to no tabs.
        const lookup = (async () => {
          const wsRes = await fetch('/api/workspaces', { headers: { Authorization: `Bearer ${session.access_token}` } })
          return wsRes.ok ? await wsRes.json() : null
        })()
        lookup.catch(() => {}) // late failure after the timeout is already handled
        let timer: ReturnType<typeof setTimeout> | undefined
        const ws = await Promise.race([
          lookup,
          new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 8000) }),
        ]).finally(() => { if (timer) clearTimeout(timer) })
        if (ws) {
          if (ws.workspace?.id) setWorkspaceId(ws.workspace.id)
          else setWsLookupFailed(true)
        } else {
          setWsLookupFailed(true)
        }
      } catch { setWsLookupFailed(true) /* no shared selection; All clients */ }
    }
  }

  const [projectsError, setProjectsError] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const projectsGenRef = useRef(0)
  // `initial` (first load) shows the skeleton and blocks New; later refreshes
  // (after creating a project, Retry) run in the background. Only the newest
  // request may update state, so overlapping refreshes can't clear `loading` early.
  const loadProjects = async (accessToken: string, opts?: { initial?: boolean }) => {
    const gen = ++projectsGenRef.current
    if (opts?.initial) setLoading(true)
    // Bounded (covers the body read) so a hung request can't leave the page
    // loading, and New disabled, forever.
    let timer: ReturnType<typeof setTimeout> | undefined
    let failed = false
    let projectsData: Project[] | null = null
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller?.abort(); reject(new Error('timeout')) }, 10000)
      })
      const load = (async () => {
        const res = await fetch('/api/projects', {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller?.signal,
        })
        if (!res.ok) throw new Error('bad status')
        return res.json()
      })()
      load.catch(() => {}) // late failure after the timeout is already handled
      const data = await Promise.race([load, timeout])
      projectsData = data.projects ?? []
    } catch (err) {
      console.error('Failed to load projects', err)
      failed = true
    } finally {
      if (timer) clearTimeout(timer)
    }
    if (gen !== projectsGenRef.current) return // superseded by a newer refresh
    if (projectsData) setProjects(projectsData)
    setProjectsError(failed)
    setLoading(false)
  }
  const retryProjects = async () => {
    if (retrying) return
    setRetrying(true)
    await loadProjects(token ?? '')
    setRetrying(false)
  }

  const loadAssignedAssets = async (accessToken: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/assets/assigned', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setAssignedAssets(data.assets ?? [])
      }
    } catch (err) {
      console.error('Failed to load assigned assets', err)
    }
    setLoading(false)
  }

  const handleDashTabChange = async (tab: 'assigned' | 'projects') => {
    setDashTab(tab)
    if (tab === 'projects' && myProjects.length === 0) {
      setMyProjectsLoading(true)
      try {
        const res = await fetch('/api/projects/assigned', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setMyProjects(data.projects ?? [])
        }
      } catch (err) {
        console.error('Failed to load assigned projects', err)
      }
      setMyProjectsLoading(false)
    }
  }

  const handleDeleteProject = async (id: string) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id))
    }
  }

  const isAdmin = role === 'admin'

  // /api/projects returns every project the user owns, across any workspaces
  // they administer, while the saved selection is keyed to one workspace.
  // Tabs and per-client filtering use only that workspace's projects.
  const wsProjects = useMemo(
    () => (workspaceId ? projects.filter((p) => {
      const ws = (p as Project & { workspace_id?: string | null }).workspace_id
      return ws === workspaceId
    }) : projects),
    [projects, workspaceId]
  )
  // New defaults its client from the selection, so wait for it to be restored
  // (or for the workspace lookup to fail, then fall back to no default).
  // Also wait for the projects fetch: without it the tabs are empty and a stored
  // client would resolve to All clients.
  const newBlocked = isAdmin && ((!hydrated && !wsLookupFailed) || loading)

  const clientTabs = useMemo<ClientTab[]>(() => {
    if (!isAdmin) return []
    return mergeExtraClients(buildClientTabs(wsProjects.map((p) => ({ client: p.client }))), extraClients)
  }, [isAdmin, wsProjects, extraClients])

  const activeClient = isAdmin && clientTabs.some((t) => t.key === selectedClient) ? selectedClient : ALL_CLIENTS_KEY
  // Hold the heading back until the stored selection is restored so it never
  // flashes "All Projects" before switching to "Projects: <client>".
  const headingReady = role !== null && (!isAdmin || ((hydrated || wsLookupFailed) && !loading))
  const activeClientLabel = clientTabs.find((t) => t.key === activeClient)?.label ?? ''
  const defaultClient = activeClient === ALL_CLIENTS_KEY || activeClient === NO_CLIENT_KEY ? '' : activeClientLabel

  // No reset here: /api/projects only lists this user's own projects, so a
  // missing client may still exist workspace-wide. The Board (workspace-wide
  // data) owns clearing stale selections; here it just displays as All.

  const filtered = (activeClient === ALL_CLIENTS_KEY ? projects : wsProjects).filter((p) =>
    (!isAdmin || matchesClient(p.client, activeClient)) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.client ?? '').toLowerCase().includes(search.toLowerCase()))
  )

  const filteredAssigned = assignedAssets.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.project_name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredMyProjects = myProjects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.client ?? '').toLowerCase().includes(search.toLowerCase())
  )

  if (authError) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-sm px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
            {authError}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        <TopBar title="Projects" icon={LayoutGrid}>
          <div className="w-56 relative hidden md:block">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={role === 'editor' ? (dashTab === 'assigned' ? 'Search your assets…' : 'Search your projects…') : 'Search projects…'}
              className="w-full pl-8 pr-3 py-1.5 text-[13px] text-th-text placeholder:text-th-faint transition-colors"
            />
          </div>

          {role !== 'editor' && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-th-sm bg-th-surface-alt border border-th-border">
              {([['grid', LayoutGrid], ['list', List]] as const).map(([v, Icon]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="p-1.5 rounded btn-press transition-colors"
                  style={{
                    background: view === v ? 'var(--th-surface)' : 'transparent',
                    color: view === v ? 'var(--th-text)' : 'var(--th-muted)',
                  }}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          )}

            {role !== 'editor' && (
              <button
                disabled={newBlocked}
                onClick={() => setShowNew(true)}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-th-full bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press hover:bg-th-accent-hover transition-colors"
              >
                <Plus size={14} /> New project
              </button>
            )}
        </TopBar>

        {role === 'editor' && (
          <div className="shrink-0 bg-th-surface border-b border-th-border px-6 flex gap-1">
            {([
              { key: 'assigned', icon: Film, label: 'Assigned to you' },
              { key: 'projects', icon: FolderKanban, label: 'My Projects' },
            ] as { key: 'assigned' | 'projects'; icon: React.ElementType; label: string }[]).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => handleDashTabChange(key)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] border-b-2 btn-press transition-colors"
                style={{
                  color: dashTab === key ? 'var(--th-accent-text)' : 'var(--th-muted)',
                  borderColor: dashTab === key ? 'var(--th-accent)' : 'transparent',
                  fontWeight: dashTab === key ? 700 : 400,
                }}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        )}

        {/* New project modal */}
        {showNew && (
          <NewContentModal
            onClose={() => setShowNew(false)}
            defaultClient={defaultClient}
            onCreated={() => { setShowNew(false); loadProjects(token ?? '') }}
          />
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {role === 'editor' ? (
            <>
              <div className="flex items-center justify-between mb-5">
                <h1 className="text-[18px] font-extrabold">{dashTab === 'assigned' ? 'Assigned to you' : 'My Projects'}</h1>
                <span className="font-mono text-[11px] text-th-muted">
                  {dashTab === 'assigned' ? `${filteredAssigned.length} assets` : `${filteredMyProjects.length} projects`}
                </span>
              </div>

              {dashTab === 'assigned' ? (
              loading ? (
                <CardGridSkeleton count={8} minWidth={240} />
              ) : filteredAssigned.length === 0 && !search ? (
                <EmptyState icon={Film} title="No assets assigned yet" sub="An admin needs to assign you to an asset first." />
              ) : filteredAssigned.length === 0 && search ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                  <p className="font-semibold">No results for "{search}"</p>
                  <p className="text-[13px] text-th-muted">Try a different search term.</p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                  {filteredAssigned.map((a) => {
                    const color = STATUS_COLOR[a.status] ?? 'var(--th-muted)'
                    const label = STATUS_LABEL[a.status] ?? a.status.toUpperCase()
                    return (
                      <Link
                        key={a.id}
                        href={`/review/${a.id}`}
                        className="flex flex-col h-full bg-th-surface border border-th-border rounded-th-lg overflow-hidden hover:border-th-accent transition-colors shadow-card hover:shadow-card-hover"
                      >
                        <div className="aspect-video shrink-0 bg-th-surface-alt flex items-center justify-center relative">
                          {a.mux_playback_id ? (
                            <img
                              src={`https://image.mux.com/${a.mux_playback_id}/thumbnail.jpg?time=1`}
                              className="w-full h-full object-cover absolute inset-0"
                              alt={a.name}
                            />
                          ) : (
                            <Film size={36} style={{ color: 'var(--th-accent-text)' }} />
                          )}
                          <span
                            className="app-pill absolute top-2.5 right-2.5 font-mono text-[10px]"
                            style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
                          >
                            {label}
                          </span>
                        </div>
                        <div className="p-3.5 flex-1 flex flex-col justify-center gap-1.5 min-h-[56px]">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13px] font-semibold truncate">{a.name}</p>
                            <span
                              className="app-pill shrink-0 font-mono text-[10px]"
                              style={{ color: priorityMeta(a.priority).color, background: `color-mix(in srgb, ${priorityMeta(a.priority).color} 16%, transparent)` }}
                            >
                              {priorityMeta(a.priority).label}
                            </span>
                          </div>
                          <p className="text-[11px] text-th-muted truncate">{a.project_client}</p>
                          <span
                            className="self-start flex items-center gap-1.5 h-7 px-2.5 rounded-th text-[11px] font-semibold mt-0.5"
                            style={a.is_complete
                              ? { background: 'color-mix(in srgb, var(--th-resolved) 16%, transparent)', color: 'var(--th-resolved)', border: '1px solid color-mix(in srgb, var(--th-resolved) 40%, transparent)' }
                              : { background: 'var(--th-surface-alt)', color: 'var(--th-muted)', border: '1px solid var(--th-border)' }}
                          >
                            {a.is_complete ? <><Check size={12} /> Complete</> : 'Pending'}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )
              ) : myProjectsLoading ? (
                <CardGridSkeleton count={8} minWidth={240} />
              ) : filteredMyProjects.length === 0 && !search ? (
                <EmptyState icon={FolderKanban} title="No projects yet" sub="Projects with work assigned to you will show up here." />
              ) : filteredMyProjects.length === 0 && search ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                  <p className="font-semibold">No results for "{search}"</p>
                  <p className="text-[13px] text-th-muted">Try a different search term.</p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                  {filteredMyProjects.map((p) => (
                    <ProjectCard key={p.id} project={p} view="grid" />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-5">
                {headingReady ? (
                  <h1 className="min-w-0 break-words text-[18px] font-extrabold">
                    {activeClient === ALL_CLIENTS_KEY ? 'All Projects' : `Projects: ${activeClient === NO_CLIENT_KEY ? 'No client' : activeClientLabel}`}
                  </h1>
                ) : (
                  <div aria-hidden className="h-6 w-40 rounded bg-th-surface animate-pulse" />
                )}
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-th-muted">
                  {projectsError && projects.length === 0 ? 'Showing projects (count unavailable)' : `Showing ${countLabel(filtered.length, 'projects')}`}
                  {activeClient !== ALL_CLIENTS_KEY && (
                    <button onClick={() => setSelectedClient(ALL_CLIENTS_KEY)} className="underline hover:text-th-text btn-press">
                      Show all clients
                    </button>
                  )}
                </span>
              </div>

              {projectsError && !loading && (
                <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-[13px] text-th-changes">
                  Couldn&apos;t load your projects.
                  <button onClick={retryProjects} aria-busy={retrying} aria-disabled={retrying} className="underline btn-press">{retrying ? 'Retrying...' : 'Retry'}</button>
                </div>
              )}
              {loading ? (
                <CardGridSkeleton count={8} minWidth={240} />
              ) : filtered.length === 0 && !search && projectsError ? null : filtered.length === 0 && !search ? (
                <EmptyState
                  icon={Film}
                  title={activeClient === ALL_CLIENTS_KEY ? 'No projects yet' : activeClient === NO_CLIENT_KEY ? 'No projects without a client' : `No projects for ${activeClientLabel} yet`}
                  sub={activeClient === ALL_CLIENTS_KEY ? 'Create your first project to get started.' : 'Create one to get started.'}
                >
                  <button
                    disabled={newBlocked}
                    onClick={() => setShowNew(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-th-full bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press hover:bg-th-accent-hover transition-colors"
                  >
                    <Plus size={14} /> {activeClient === ALL_CLIENTS_KEY ? 'Create first project' : defaultClient ? `Create project for ${defaultClient}` : 'Create project'}
                  </button>
                </EmptyState>
              ) : filtered.length === 0 && search ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                  <p className="font-semibold">No results for "{search}"</p>
                  <p className="text-[13px] text-th-muted">Try a different search term.</p>
                </div>
              ) : view === 'grid' ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                  {filtered.map((p) => (
                    <ProjectCard key={p.id} project={p} view="grid" onDelete={handleDeleteProject} />
                  ))}
                  <button
                    disabled={newBlocked}
                    onClick={() => setShowNew(true)}
                    className="flex flex-col h-full rounded-th-lg border-2 border-dashed border-th-border text-th-muted hover:border-th-accent hover:text-th-accent-text transition-colors btn-press overflow-hidden"
                  >
                    <div className="aspect-video shrink-0 flex items-center justify-center">
                      <Upload size={22} />
                    </div>
                    <div className="p-3.5 flex-1 flex items-center justify-center min-h-[56px]">
                      <span className="text-[13px] font-medium">New project</span>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="bg-th-surface rounded-th-lg border border-th-border overflow-hidden">
                  <div className="flex items-center px-5 py-2 border-b border-th-border font-mono text-[10px] text-th-faint uppercase tracking-wider">
                    <span className="flex-1">Project</span>
                    <span className="w-28">Status</span>
                    <span className="w-20 text-right">Updated</span>
                  </div>
                  {filtered.map((p) => (
                    <ProjectCard key={p.id} project={p} view="list" onDelete={handleDeleteProject} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {isAdmin && !authError && !loading && !hydrated && wsLookupFailed && (
          <div className="shrink-0 bg-th-surface border-t border-th-border px-4 py-2 text-[11px] text-th-muted">
            Client tabs are unavailable right now (workspace lookup failed). Showing all projects - refresh to retry.
          </div>
        )}
        {isAdmin && !authError && !loading && hydrated && (
          <ClientTabStrip
            tabs={clientTabs}
            allCount={projects.length}
            countFor={(key) => wsProjects.filter((p) => matchesClient(p.client, key)).length}
            activeKey={activeClient}
            onSelect={setSelectedClient}
            onAdd={(name) => addClient(name, clientTabs.map((t) => t.key))}
            unit="projects"
          />
        )}
      </div>
      <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </>
  )
}