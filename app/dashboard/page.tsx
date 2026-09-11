'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Grid3X3, List, Plus, Upload, LogOut, Film, Check, FolderKanban } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { CardGridSkeleton } from '@/components/ui/CardGridSkeleton'
import { ConfirmDialog, useConfirm } from '@/components/ui/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { useSessionGuard } from '@/lib/useSessionGuard'
import type { Project } from '@/lib/types'

interface AssignedAsset {
  id: string
  name: string
  status: string
  is_complete: boolean
  mux_playback_id: string | null
  project_id: string | null
  project_name: string
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
  const router = useRouter()
  const { session, ready } = useSessionGuard()
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newClient, setNewClient] = useState('')
  const [creating, setCreating] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [role, setRole] = useState<'admin' | 'editor' | null>(null)
  const [assignedAssets, setAssignedAssets] = useState<AssignedAsset[]>([])
  const [authError, setAuthError] = useState('')
  const [dashTab, setDashTab] = useState<'assigned' | 'projects'>('assigned')
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [myProjectsLoading, setMyProjectsLoading] = useState(false)

  useEffect(() => {
    if (ready && session) checkAuthAndLoad()
  }, [ready, session])

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/auth/login')
      } else {
        setToken(session.access_token)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [router])

  const checkAuthAndLoad = async () => {
    if (!session) return
    setToken(session.access_token)

    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', session.user.id)

    if (membershipError) {
      // Never redirect off a failed role check - show an error instead of
      // silently rendering the wrong view.
      setAuthError('Failed to verify your workspace role. Please refresh and try again.')
      setLoading(false)
      return
    }

    const roles = (memberships ?? []).map((m) => m.role)
    const currentRole = roles.includes('admin') ? 'admin' : roles.includes('editor') ? 'editor' : null
    setRole(currentRole)

    if (currentRole === 'editor') {
      loadAssignedAssets(session.access_token)
    } else {
      loadProjects(session.access_token)
    }
  }

  const loadProjects = async (accessToken: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects ?? [])
      }
    } catch (err) {
      console.error('Failed to load projects', err)
    }
    setLoading(false)
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
    if (tab === 'projects' && myProjects.length === 0 && token) {
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
    if (!token) return
    const res = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id))
    }
  }

  const createProject = async () => {
    if (!newName.trim() || !token) return
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          client: newClient.trim(),
          emoji: '🎬',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setProjects((prev) => [data.project, ...prev])
        setNewName('')
        setNewClient('')
        setShowNew(false)
      } else {
        const err = await res.json()
        console.error('Create project error:', err)
      }
    } catch (err) {
      console.error('Network error:', err)
    }
    setCreating(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.client ?? '').toLowerCase().includes(search.toLowerCase())
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
      <div className="flex h-screen overflow-hidden bg-th-bg">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-sm px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
            {authError}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center gap-3 px-6">
          <div className="flex-1 max-w-sm relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={role === 'editor' ? (dashTab === 'assigned' ? 'Search your assets…' : 'Search your projects…') : 'Search projects…'}
              className="w-full pl-8 pr-3 py-1.5 rounded-th-sm bg-th-surface-alt border border-th-border text-[13px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors"
            />
          </div>

          {role !== 'editor' && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-th-sm bg-th-surface-alt border border-th-border">
              {([['grid', Grid3X3], ['list', List]] as const).map(([v, Icon]) => (
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

          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={async () => {
                const ok = await confirm({ title: 'Log out of CollabCut?', confirmLabel: 'Yes, log out' })
                if (ok) handleLogout()
              }}
              className="flex items-center gap-1.5 h-8 px-3 rounded-th bg-th-surface-alt border border-th-border text-[13px] text-th-muted btn-press hover:text-th-changes transition-colors"
            >
              <LogOut size={13} /> Logout
            </button>
            {role !== 'editor' && (
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity"
              >
                <Plus size={14} /> New project
              </button>
            )}
          </div>
        </div>

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
                  color: dashTab === key ? 'var(--th-accent)' : 'var(--th-muted)',
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-th-surface border border-th-border rounded-th-lg p-6 w-full max-w-sm shadow-panel animate-slide-up">
              <h2 className="font-bold text-[16px] mb-4">New project</h2>
              <div className="space-y-3 mb-5">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-th-muted mb-1.5">
                    Project name *
                  </label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Wedding Promo — Singh & Mehta"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && createProject()}
                    className="w-full px-3.5 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[14px] text-th-text outline-none focus:border-th-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-th-muted mb-1.5">
                    Client name
                  </label>
                  <input
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    placeholder="Private Client"
                    onKeyDown={(e) => e.key === 'Enter' && createProject()}
                    className="w-full px-3.5 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[14px] text-th-text outline-none focus:border-th-accent transition-colors"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowNew(false); setNewName(''); setNewClient('') }}
                  className="flex-1 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[13px] font-medium btn-press hover:bg-th-surface-hov transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createProject}
                  disabled={creating || !newName.trim()}
                  className="flex-1 py-2.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-bold btn-press hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create project'}
                </button>
              </div>
            </div>
          </div>
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
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                  <div className="text-5xl"><Film size={48} style={{ color: 'var(--th-accent)' }} /></div>
                  <div>
                    <p className="font-semibold mb-1">No assets assigned yet</p>
                    <p className="text-[13px] text-th-muted">An admin needs to assign you to an asset first.</p>
                  </div>
                </div>
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
                            <Film size={36} style={{ color: 'var(--th-accent)' }} />
                          )}
                          <span
                            className="absolute top-2.5 right-2.5 font-mono text-[10px] px-2 py-0.5 rounded-th-full"
                            style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
                          >
                            {label}
                          </span>
                        </div>
                        <div className="p-3.5 flex-1 flex flex-col justify-center gap-1.5 min-h-[56px]">
                          <p className="text-[13px] font-semibold truncate">{a.name}</p>
                          <p className="text-[11px] text-th-muted truncate">{a.project_name}</p>
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
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                  <FolderKanban size={48} style={{ color: 'var(--th-accent)' }} />
                  <div>
                    <p className="font-semibold mb-1">No projects yet</p>
                    <p className="text-[13px] text-th-muted">Projects with work assigned to you will show up here.</p>
                  </div>
                </div>
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
              <div className="flex items-center justify-between mb-5">
                <h1 className="text-[18px] font-extrabold">All Projects</h1>
                <span className="font-mono text-[11px] text-th-muted">{filtered.length} projects</span>
              </div>

              {loading ? (
                <CardGridSkeleton count={8} minWidth={240} />
              ) : filtered.length === 0 && !search ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                  <div className="text-5xl"><Film size={48} style={{ color: 'var(--th-accent)' }} /></div>
                  <div>
                    <p className="font-semibold mb-1">No projects yet</p>
                    <p className="text-[13px] text-th-muted">Create your first project to get started.</p>
                  </div>
                  <button
                    onClick={() => setShowNew(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press"
                  >
                    <Plus size={14} /> Create first project
                  </button>
                </div>
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
                    onClick={() => setShowNew(true)}
                    className="flex flex-col h-full rounded-th-lg border-2 border-dashed border-th-border text-th-muted hover:border-th-accent hover:text-th-accent transition-colors btn-press overflow-hidden"
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
      </div>
      <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  )
}