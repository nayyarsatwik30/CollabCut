'use client'

import { UploadModal } from '@/components/project/UploadModal'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Share2, Upload, UserPlus } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { ThemePicker } from '@/components/layout/ThemePicker'
import { Avatar } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'

type Tab = 'assets' | 'members' | 'activity'

interface Project {
  id: string
  name: string
  client: string
  status: string
  emoji: string
}

interface Asset {
  id: string
  name: string
  version: number
  duration_sec: number
  size_bytes: number
  status: string
  mux_playback_id?: string
  created_at: string
}

export default function ProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('assets')
  const [project, setProject] = useState<Project | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    loadData()
  }, [params.id])

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }

    const projectRes = await fetch(`/api/projects/${params.id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    if (projectRes.ok) {
      const data = await projectRes.json()
      setProject(data.project)
      setAssets(data.project.assets ?? [])
    }
    setLoading(false)
  }

  const formatSize = (bytes: number) => {
    if (!bytes) return '—'
    if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
    return `${(bytes / 1e6).toFixed(0)} MB`
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

        {/* Upload Modal */}
        {showUpload && (
          <UploadModal
            projectId={params.id}
            onClose={() => setShowUpload(false)}
            onUploaded={() => { setShowUpload(false); loadData() }}
          />
        )}

        {/* Top bar */}
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center gap-2 px-5">
          <Link href="/dashboard" className="text-[13px] text-th-muted hover:text-th-text transition-colors">
            Projects
          </Link>
          <ChevronRight size={13} className="text-th-faint" />
          <span className="text-[13px] font-semibold truncate">{project?.name ?? 'Project'}</span>
          {project?.client && (
            <span className="text-[12px] text-th-muted">— {project.client}</span>
          )}
          <div className="ml-auto flex items-center gap-2.5">
            <ThemePicker />
            <button className="flex items-center gap-1.5 h-8 px-3.5 rounded-th bg-th-surface-alt border border-th-border text-[13px] text-th-text btn-press">
              <Share2 size={13} /> Share
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity">
              <Upload size={13} /> Upload
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 bg-th-surface border-b border-th-border px-5 flex gap-0">
          {(['assets', 'members', 'activity'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-3 text-[13px] capitalize transition-colors border-b-2 btn-press"
              style={{
                color: tab === t ? 'var(--th-accent)' : 'var(--th-muted)',
                borderColor: tab === t ? 'var(--th-accent)' : 'transparent',
                fontWeight: tab === t ? 700 : 400,
              }}>
              {t}
              {t === 'assets' && (
                <span className="ml-1.5 font-mono text-[10px] text-th-faint">{assets.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Assets */}
          {tab === 'assets' && (
            <>
              {assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                  <div className="text-5xl">🎞️</div>
                  <div>
                    <p className="font-semibold mb-1">No assets yet</p>
                    <p className="text-[13px] text-th-muted">Upload your first cut to start reviewing.</p>
                  </div>
                  <button
                    onClick={() => setShowUpload(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press">
                    <Upload size={14} /> Upload first cut
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                  {assets.map((a) => (
                    <Link key={a.id} href={`/review/${a.id}`}
                      className="block bg-th-surface border border-th-border rounded-th-lg overflow-hidden hover:border-th-accent transition-colors shadow-card hover:shadow-card-hover">
                      <div className="h-28 bg-th-surface-alt flex flex-col items-center justify-center gap-2 relative">
                        <span className="text-3xl">🎞️</span>
                        <span className="font-mono text-[11px] text-th-muted">{formatDuration(a.duration_sec)}</span>
                        <div className="absolute top-2.5 left-2.5 font-mono text-[10px] px-1.5 py-px rounded bg-th-bg/70 text-th-muted border border-th-border">
                          v{a.version}
                        </div>
                        <div
                          className="absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-th-full font-mono"
                          style={{
                            color: a.status === 'approved' ? 'var(--th-resolved)' : a.status === 'changes' ? 'var(--th-changes)' : 'var(--th-open)',
                            background: a.status === 'approved'
                              ? 'color-mix(in srgb, var(--th-resolved) 14%, transparent)'
                              : a.status === 'changes'
                              ? 'color-mix(in srgb, var(--th-changes) 14%, transparent)'
                              : 'color-mix(in srgb, var(--th-open) 14%, transparent)',
                          }}>
                          {a.status === 'approved' ? 'APPROVED'
                            : a.status === 'changes' ? 'NEEDS CHANGES'
                            : a.status === 'processing' ? 'PROCESSING'
                            : 'IN REVIEW'}
                        </div>
                      </div>
                      <div className="p-3.5">
                        <p className="text-[13px] font-semibold truncate mb-3">{a.name}</p>
                        <div className="flex items-center justify-between text-[11px] text-th-faint font-mono">
                          <span>{formatSize(a.size_bytes)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                  <button
                    onClick={() => setShowUpload(true)}
                    className="flex flex-col items-center justify-center gap-3 h-[172px] rounded-th-lg border-2 border-dashed border-th-border text-th-muted hover:border-th-accent hover:text-th-accent transition-colors btn-press">
                    <Upload size={20} />
                    <span className="text-[12px] font-medium">Upload cut</span>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Members */}
          {tab === 'members' && (
            <div className="max-w-lg">
              <div className="bg-th-surface rounded-th border border-th-border overflow-hidden mb-4">
                <div className="flex items-center gap-3.5 px-5 py-3.5 border-b border-th-border">
                  <Avatar initials="YS" color="#4CAF7D" size="md" />
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold">You</p>
                    <p className="text-[11px] text-th-muted">Owner</p>
                  </div>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-th-full bg-th-surface-alt border border-th-border text-th-muted">Owner</span>
                </div>
              </div>
              <button className="flex items-center gap-2 h-9 px-4 rounded-th bg-th-surface-alt border border-th-border text-[13px] text-th-text btn-press">
                <UserPlus size={14} className="text-th-muted" /> Invite reviewer
              </button>
            </div>
          )}

          {/* Activity */}
          {tab === 'activity' && (
            <div className="max-w-lg">
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="text-4xl">📋</div>
                <p className="font-semibold">No activity yet</p>
                <p className="text-[13px] text-th-muted">Activity will appear here as your team reviews cuts.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}