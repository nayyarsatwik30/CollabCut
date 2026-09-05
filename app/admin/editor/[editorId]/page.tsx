'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Check, Film } from 'lucide-react'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { supabase } from '@/lib/supabase'

interface Asset {
  id: string
  name: string
  version: number
  duration_sec: number
  status: string
  mux_playback_id?: string
}

interface Project {
  id: string
  name: string
  client: string
  assets: Asset[]
}

interface Editor {
  id: string
  name: string
  email: string
}

export default function AdminEditorPage({ params }: { params: { editorId: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [token, setToken] = useState('')

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.editorId])

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }
    setToken(session.access_token)

    try {
      const res = await fetch(`/api/admin/editor/${params.editorId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.status === 403) {
        router.push('/dashboard')
        return
      }

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to load editor')
      } else {
        setEditor(data.editor)
        setProjects(data.projects ?? [])
        setAssignedIds(new Set(data.assignedAssetIds ?? []))
      }
    } catch (err) {
      setError('Failed to load editor')
    }
    setLoading(false)
  }

  const toggleAssignment = async (assetId: string, currentlyAssigned: boolean) => {
    setPendingIds((prev) => new Set(prev).add(assetId))
    setAssignedIds((prev) => {
      const next = new Set(prev)
      currentlyAssigned ? next.delete(assetId) : next.add(assetId)
      return next
    })

    try {
      const res = await fetch(`/api/admin/editor/${params.editorId}/assets`, {
        method: currentlyAssigned ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assetId }),
      })

      if (!res.ok) {
        // revert on failure
        setAssignedIds((prev) => {
          const next = new Set(prev)
          currentlyAssigned ? next.add(assetId) : next.delete(assetId)
          return next
        })
      }
    } catch (err) {
      setAssignedIds((prev) => {
        const next = new Set(prev)
        currentlyAssigned ? next.add(assetId) : next.delete(assetId)
        return next
      })
    }

    setPendingIds((prev) => {
      const next = new Set(prev)
      next.delete(assetId)
      return next
    })
  }

  const formatDuration = (sec: number) => {
    if (!sec) return '—'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-th-bg">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center gap-2 px-6">
          <Link href="/admin" className="text-[13px] text-th-muted hover:text-th-text transition-colors">
            Admin
          </Link>
          <ChevronRight size={13} className="text-th-faint" />
          <span className="text-[13px] font-semibold truncate">{editor?.name ?? 'Editor'}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl space-y-6">
            {error && (
              <div className="px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
                {error}
              </div>
            )}

            {editor && (
              <div>
                <h2 className="text-[16px] font-bold mb-1">{editor.name}</h2>
                <p className="text-[13px] text-th-muted font-mono">{editor.email}</p>
              </div>
            )}

            <div>
              <p className="text-[13px] text-th-muted mb-4">
                Toggle which assets {editor?.name ?? 'this editor'} has access to. Click an asset to open it in review.
              </p>

              {projects.length === 0 && (
                <p className="text-[13px] text-th-muted">No projects in your workspace yet.</p>
              )}

              <div className="space-y-5">
                {projects.map((project) => (
                  <div key={project.id} className="rounded-th-lg border border-th-border bg-th-surface overflow-hidden">
                    <div className="px-5 py-3 border-b border-th-border">
                      <span className="text-[13px] font-semibold">{project.name}</span>
                      {project.client && (
                        <span className="ml-2 text-[12px] text-th-muted">— {project.client}</span>
                      )}
                    </div>

                    {project.assets.length === 0 ? (
                      <p className="px-5 py-3 text-[12px] text-th-muted">No assets in this project.</p>
                    ) : (
                      project.assets.map((asset) => {
                        const assigned = assignedIds.has(asset.id)
                        const pending = pendingIds.has(asset.id)
                        return (
                          <div
                            key={asset.id}
                            className="flex items-center gap-3.5 px-5 py-3 border-b border-th-border last:border-b-0 transition-colors hover:bg-th-surface-alt"
                            style={assigned ? { background: 'color-mix(in srgb, var(--th-accent) 8%, transparent)' } : undefined}
                          >
                            <button
                              onClick={() => !pending && toggleAssignment(asset.id, assigned)}
                              disabled={pending}
                              title={assigned ? 'Unassign' : 'Assign'}
                              className="w-5 h-5 shrink-0 rounded-th-sm border flex items-center justify-center transition-colors disabled:opacity-50"
                              style={{
                                background: assigned ? 'var(--th-accent)' : 'transparent',
                                borderColor: assigned ? 'var(--th-accent)' : 'var(--th-border)',
                              }}
                            >
                              {assigned && <Check size={13} className="text-th-accent-fg" />}
                            </button>

                            <button
                              onClick={() => router.push(`/review/${asset.id}`)}
                              className="flex-1 flex items-center gap-3 min-w-0 text-left"
                            >
                              <div className="w-9 h-9 rounded-th-sm bg-th-surface-alt border border-th-border flex items-center justify-center shrink-0 overflow-hidden">
                                {asset.mux_playback_id ? (
                                  <img
                                    src={`https://image.mux.com/${asset.mux_playback_id}/thumbnail.jpg?time=1`}
                                    className="w-full h-full object-cover"
                                    alt={asset.name}
                                  />
                                ) : (
                                  <Film size={14} style={{ color: 'var(--th-accent)' }} />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium truncate">{asset.name}</p>
                                <p className="text-[11px] text-th-muted font-mono">
                                  v{asset.version} · {formatDuration(asset.duration_sec)}
                                </p>
                              </div>
                            </button>

                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-th-full font-mono shrink-0"
                              style={{
                                color: asset.status === 'approved' ? 'var(--th-resolved)' : asset.status === 'changes' ? 'var(--th-changes)' : 'var(--th-open)',
                                background: asset.status === 'approved'
                                  ? 'color-mix(in srgb, var(--th-resolved) 14%, transparent)'
                                  : asset.status === 'changes'
                                    ? 'color-mix(in srgb, var(--th-changes) 14%, transparent)'
                                    : 'color-mix(in srgb, var(--th-open) 14%, transparent)',
                              }}
                            >
                              {asset.status === 'approved' ? 'APPROVED'
                                : asset.status === 'changes' ? 'NEEDS CHANGES'
                                  : asset.status === 'processing' ? 'PROCESSING'
                                    : 'IN REVIEW'}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
