'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Grid3X3, List, Plus, Upload, LogOut, Film, Check } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/types'

interface AssignedAsset {
  id: string
  name: string
  status: string
  is_complete: boolean
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
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [authError, setAuthError] = useState('')
  const hasRedirectedToAdmin = useRef(false)

  useEffect(() => {
    checkAuthAndLoad()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/auth/login')
      } else {
        setToken(session.access_token)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const checkAuthAndLoad = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/auth/login')
      return
    }
    setToken(session.access_token)

    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', session.user.id)

    if (membershipError) {
      // Never redirect off a failed role check - show an error instead so we
      // can't end up bouncing between /admin and /dashboard.
      setAuthError('Failed to verify your workspace role. Please refresh and try again.')
      setLoading(false)
      return
    }

    const roles = (memberships ?? []).map((m) => m.role)
    const currentRole = roles.includes('admin') ? 'admin' : roles.includes('editor') ? 'editor' : null
    setRole(currentRole)

    if (currentRole === 'admin') {
      if (!hasRedirectedToAdmin.current) {
        hasRedirectedToAdmin.current = true
        router.replace('/admin')
      }
      return
    }

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

  const toggleComplete = async (assetId: string, currentlyComplete: boolean) => {
    if (!token) return
    setTogglingIds((prev) => new Set(prev).add(assetId))
    setAssignedAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, is_complete: !currentlyComplete } : a))
    )

    try {
      const res = await fetch(`/api/assets/${assetId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ complete: !currentlyComplete }),
      })
      if (!res.ok) {
        setAssignedAssets((prev) =>
          prev.map((a) => (a.id === assetId ? { ...a, is_complete: currentlyComplete } : a))
        )
      }
    } catch (err) {
      setAssignedAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, is_complete: currentlyComplete } : a))
      )
    }

    setTogglingIds((prev) => {
      const next = new Set(prev)
      next.delete(assetId)
      return next
    })
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
              placeholder={role === 'editor' ? 'Search your assets…' : 'Search projects…'}
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
              onClick={handleLogout}
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
                <h1 className="text-[18px] font-extrabold">Assigned to you</h1>
                <span className="font-mono text-[11px] text-th-muted">{filteredAssigned.length} assets</span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
                    <p className="text-[13px] text-th-muted">Loading assets…</p>
                  </div>
                </div>
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
                <div className="bg-th-surface rounded-th-lg border border-th-border overflow-hidden">
                  <div className="flex items-center px-5 py-2 border-b border-th-border font-mono text-[10px] text-th-faint uppercase tracking-wider">
                    <span className="flex-1">Video</span>
                    <span className="w-40">Project</span>
                    <span className="w-28">Status</span>
                    <span className="w-32 text-right">Complete</span>
                  </div>
                  {filteredAssigned.map((a) => {
                    const color = STATUS_COLOR[a.status] ?? 'var(--th-muted)'
                    const label = STATUS_LABEL[a.status] ?? a.status.toUpperCase()
                    const isToggling = togglingIds.has(a.id)
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-4 px-5 py-3.5 border-b border-th-border last:border-b-0 hover:bg-th-surface-alt transition-colors"
                      >
                        <Link href={`/review/${a.id}`} className="flex-1 flex items-center gap-3 min-w-0">
                          <Film size={18} style={{ color: 'var(--th-accent)' }} />
                          <span className="text-[13px] font-semibold truncate">{a.name}</span>
                        </Link>
                        <span className="w-40 text-[12px] text-th-muted truncate">{a.project_name}</span>
                        <span
                          className="w-28 font-mono text-[10px] px-2 py-0.5 rounded-th-full inline-block text-center"
                          style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
                        >
                          {label}
                        </span>
                        <div className="w-32 flex justify-end">
                          <button
                            onClick={() => toggleComplete(a.id, a.is_complete)}
                            disabled={isToggling}
                            className="flex items-center gap-1.5 h-8 px-3 rounded-th text-[12px] font-semibold btn-press transition-colors disabled:opacity-50"
                            style={a.is_complete
                              ? { background: 'color-mix(in srgb, var(--th-resolved) 16%, transparent)', color: 'var(--th-resolved)', border: '1px solid color-mix(in srgb, var(--th-resolved) 40%, transparent)' }
                              : { background: 'var(--th-surface-alt)', color: 'var(--th-muted)', border: '1px solid var(--th-border)' }}
                          >
                            {a.is_complete ? <><Check size={13} /> Complete</> : 'Mark complete'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
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
                <div className="flex items-center justify-center py-24">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
                    <p className="text-[13px] text-th-muted">Loading projects…</p>
                  </div>
                </div>
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
    </div>
  )
}