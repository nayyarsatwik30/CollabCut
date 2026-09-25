'use client'

import { UploadModal } from '@/components/project/UploadModal'
import { RawFootageArchive } from '@/components/project/RawFootageArchive'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronRight, Upload, Trash2, Video, Film, CheckCircle2, Clock } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Avatar } from '@/components/ui/Badge'
import { ProjectPageSkeleton } from '@/components/project/ProjectPageSkeleton'
import { useSessionGuard } from '@/lib/useSessionGuard'

type Tab = 'assets' | 'raw-footage' | 'members' | 'brief'

const TABS: { id: Tab; label: string }[] = [
  { id: 'assets', label: 'Assets' },
  { id: 'raw-footage', label: 'Raw Footage' },
  { id: 'members', label: 'Members' },
  { id: 'brief', label: 'Brief' },
]

interface Member {
  id: string
  name: string
  email: string
  avatar_color: string
}

interface Project {
  id: string
  name: string
  client: string
  status: string
  emoji: string
  workspace_id?: string | null
  owner?: Member | null
  members?: Member[]
  viewer_is_admin?: boolean
  brief_notes?: string | null
  brief_reference?: string | null
  brief_deadline?: string | null
  brief_drive_link?: string | null
}

interface Asset {
  id: string
  name: string
  version: number
  duration_sec: number
  size_bytes: number
  status: string
  mux_playback_id?: string
  mux_upload_id?: string | null
  created_at: string
  is_complete?: boolean
  cut_type: 'custom' | 'board'
}

const BRIEF_LABEL = 'font-mono text-[10px] uppercase tracking-wider text-th-muted font-semibold mb-1.5 block'
const BRIEF_INPUT = 'w-full px-3 py-2 text-[13px] bg-th-surface-alt border border-th-border text-th-text focus:outline-none focus:border-th-accent'

function BriefTab({ project, token, onSaved }: {
  project: Project
  token: string | null
  onSaved: (p: Project) => void
}) {
  const isAdmin = !!project.viewer_is_admin
  const [notes, setNotes] = useState(project.brief_notes ?? '')
  const [reference, setReference] = useState(project.brief_reference ?? '')
  const [deadline, setDeadline] = useState(project.brief_deadline?.slice(0, 10) ?? '')
  const [driveLink, setDriveLink] = useState(project.brief_drive_link ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const save = async () => {
    setSaving(true)
    setMessage(null)
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        brief_notes: notes,
        brief_reference: reference,
        brief_deadline: deadline,
        brief_drive_link: driveLink,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const { project: saved } = await res.json()
      onSaved({
        ...project,
        brief_notes: saved.brief_notes,
        brief_reference: saved.brief_reference,
        brief_deadline: saved.brief_deadline,
        brief_drive_link: saved.brief_drive_link,
      })
      setMessage({ text: 'Brief saved', ok: true })
    } else {
      const err = await res.json().catch(() => ({}))
      setMessage({ text: err.error ?? 'Could not save the brief', ok: false })
    }
  }

  if (!isAdmin) {
    const empty = !project.brief_notes && !project.brief_reference && !project.brief_deadline && !project.brief_drive_link
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-th-surface border border-th-border divide-y divide-th-border" style={{ borderRadius: 0 }}>
          {empty && <div className="px-5 py-8 text-center text-[13px] text-th-muted">No project brief yet.</div>}
          {project.brief_notes && (
            <div className="px-5 py-3.5">
              <span className={BRIEF_LABEL}>Notes</span>
              <p className="text-[13px] text-th-text whitespace-pre-wrap leading-relaxed">{project.brief_notes}</p>
            </div>
          )}
          {project.brief_reference && (
            <div className="px-5 py-3.5">
              <span className={BRIEF_LABEL}>Reference</span>
              <p className="text-[13px] text-th-text whitespace-pre-wrap leading-relaxed">{project.brief_reference}</p>
            </div>
          )}
          {project.brief_deadline && (
            <div className="px-5 py-3.5">
              <span className={BRIEF_LABEL}>Deadline</span>
              <p className="text-[13px] text-th-text">
                {new Date(`${project.brief_deadline.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          )}
          {project.brief_drive_link && (
            <div className="px-5 py-3.5">
              <span className={BRIEF_LABEL}>Drive link</span>
              <a
                href={project.brief_drive_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-th-accent-text underline break-all"
              >
                {project.brief_drive_link}
              </a>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-th-surface border border-th-border p-5 flex flex-col gap-4" style={{ borderRadius: 0 }}>
        <label>
          <span className={BRIEF_LABEL}>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5}
            className={BRIEF_INPUT} style={{ borderRadius: 0 }} placeholder="What should editors know about this project?" />
        </label>
        <label>
          <span className={BRIEF_LABEL}>Reference</span>
          <textarea value={reference} onChange={(e) => setReference(e.target.value)} rows={3}
            className={BRIEF_INPUT} style={{ borderRadius: 0 }} placeholder="Reference videos, links or style notes" />
        </label>
        <label>
          <span className={BRIEF_LABEL}>Deadline</span>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
            className={BRIEF_INPUT} style={{ borderRadius: 0 }} />
        </label>
        <label>
          <span className={BRIEF_LABEL}>Drive link</span>
          <input type="url" value={driveLink} onChange={(e) => setDriveLink(e.target.value)}
            className={BRIEF_INPUT} style={{ borderRadius: 0 }} placeholder="https://drive.google.com/..." />
        </label>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-[13px] font-semibold bg-th-accent text-th-accent-fg hover:opacity-90 transition-opacity disabled:opacity-50 btn-press"
            style={{ borderRadius: 0 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {message && (
            <span className="text-[12px]" style={{ color: message.ok ? 'var(--th-resolved)' : 'var(--th-open)' }}>{message.text}</span>
          )}
        </div>
        <p className="text-[11px] text-th-muted">Shown on the review screen for any cut that has no brief of its own. Not visible on share links.</p>
      </div>
    </div>
  )
}

export default function ProjectPage({ params }: { params: { id: string } }) {
  const { session, ready } = useSessionGuard()
  const [tab, setTab] = useState<Tab>('assets')
  const [project, setProject] = useState<Project | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [showUploadCustom, setShowUploadCustom] = useState(false)
  const [showUploadBoard, setShowUploadBoard] = useState(false)

  useEffect(() => {
    if (ready && session) loadData()
  }, [ready, session, params.id])

  // mux_playback_id lands async (Mux processing + webhook) after the one
  // loadData() call an upload already triggers - poll until every asset
  // that's actually mid-upload (has mux_upload_id) picks up its
  // thumbnail, instead of leaving newer cards stuck on the fallback icon
  // forever. Capped per distinct pending set so a permanently-failed
  // encode doesn't poll forever - progress (a new upload, one resolving)
  // resets the cap. Self-scheduling once started, via recursive
  // setTimeout, rather than relying on the [assets] dependency to
  // re-trigger the next tick - a poll that fails or comes back with no
  // change wouldn't otherwise change `assets`, so the effect would never
  // re-run and the chain would silently die instead of retrying.
  const pollState = useRef({ pendingKey: '', attempts: 0, running: false })
  const assetsRef = useRef(assets)
  assetsRef.current = assets
  const pollTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const pollCancelledRef = useRef(false)

  useEffect(() => {
    pollCancelledRef.current = false
    return () => {
      pollCancelledRef.current = true
      clearTimeout(pollTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const pendingKey = assets
      .filter((a) => a.mux_upload_id && !a.mux_playback_id)
      .map((a) => a.id)
      .sort()
      .join(',')
    if (!pendingKey || pollState.current.running) return

    if (pendingKey !== pollState.current.pendingKey) {
      pollState.current.pendingKey = pendingKey
      pollState.current.attempts = 0
    }
    if (pollState.current.attempts >= 15) return

    pollState.current.running = true

    const scheduleNext = () => {
      const currentPendingKey = assetsRef.current
        .filter((a) => a.mux_upload_id && !a.mux_playback_id)
        .map((a) => a.id)
        .sort()
        .join(',')

      if (!currentPendingKey) {
        pollState.current.running = false
        return
      }
      if (currentPendingKey !== pollState.current.pendingKey) {
        pollState.current.pendingKey = currentPendingKey
        pollState.current.attempts = 0
      }
      if (pollState.current.attempts >= 15) {
        pollState.current.running = false
        return
      }

      pollState.current.attempts += 1
      pollTimerRef.current = setTimeout(async () => {
        if (pollCancelledRef.current) return
        try {
          await loadData()
        } catch {
          // Transient failure (e.g. a DB timeout) - swallow it and
          // let the next poll cycle retry instead of surfacing a broken
          // UI for one bad fetch.
        }
        if (pollCancelledRef.current) return
        scheduleNext()
      }, 8000)
    }

    scheduleNext()
  }, [assets])

  const loadData = async () => {
    if (!session) return
    setToken(session.access_token)

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

  const handleDeleteAsset = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this asset?')) return
    await fetch(`/api/assets/${id}/delete`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    loadData()
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

  const customAssets = assets.filter((a) => a.cut_type === 'custom')
  const boardAssets = assets.filter((a) => a.cut_type === 'board')

  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-th-bg">
        <Sidebar />
        <ProjectPageSkeleton />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Upload Modals */}
        {showUploadCustom && (
          <UploadModal
            projectId={params.id}
            cutType="custom"
            onClose={() => setShowUploadCustom(false)}
            onUploaded={() => { setShowUploadCustom(false); loadData() }}
          />
        )}
        {showUploadBoard && (
          <UploadModal
            projectId={params.id}
            cutType="board"
            onClose={() => setShowUploadBoard(false)}
            onUploaded={() => { setShowUploadBoard(false); loadData() }}
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
        </div>

        {/* Tabs */}
        <div className="shrink-0 bg-th-surface border-b border-th-border px-5 flex gap-0">
          {TABS.filter((t) => t.id !== 'raw-footage' || project?.viewer_is_admin).map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className="px-4 py-3 text-[13px] transition-colors border-b-2 btn-press"
              style={{
                color: tab === id ? 'var(--th-accent-text)' : 'var(--th-muted)',
                borderColor: tab === id ? 'var(--th-accent)' : 'transparent',
                fontWeight: tab === id ? 700 : 400,
              }}>
              {label}
              {id === 'assets' && (
                <span className="ml-1.5 font-mono text-[10px] text-th-faint">{assets.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Assets: Custom Cut / Board Cut split, both always visible */}
          {tab === 'assets' && (
            <div className="flex flex-col gap-8">
              {/* Custom Cut */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[13px] font-bold">Custom Cut</h2>
                    <span className="font-mono text-[10px] text-th-faint">{customAssets.length}</span>
                  </div>
                  <button
                    onClick={() => setShowUploadCustom(true)}
                    className="flex items-center gap-1.5 h-8 px-3.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity">
                    <Upload size={13} /> Upload
                  </button>
                </div>

                {customAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-center border border-dashed border-th-border rounded-th-lg">
                    <p className="text-[13px] text-th-muted">No custom cuts yet.</p>
                    <button
                      onClick={() => setShowUploadCustom(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-th bg-th-accent text-th-accent-fg text-[12px] font-semibold btn-press">
                      <Upload size={13} /> Upload first cut
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                    {customAssets.map((a) => (
                      <Link key={a.id} href={`/review/${a.id}`}
                        className="group relative flex flex-col h-full bg-th-surface border border-th-border rounded-th-lg overflow-hidden hover:border-th-accent transition-colors shadow-card hover:shadow-card-hover">
                        <button
                          onClick={(e) => handleDeleteAsset(e, a.id)}
                          className="absolute top-2.5 left-2.5 p-1.5 rounded-th-sm bg-th-bg/70 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:text-th-changes z-20">
                          <Trash2 size={13} />
                        </button>
                        <div className="aspect-video shrink-0 bg-th-surface-alt flex flex-col items-center justify-center gap-2 relative">
                          {a.mux_playback_id ? (
                            <img
                              src={`https://image.mux.com/${a.mux_playback_id}/thumbnail.jpg?time=1`}
                              className="w-full h-full object-cover absolute inset-0"
                              alt={a.name}
                            />
                          ) : (
                            <Film size={28} style={{ color: 'var(--th-accent-text)' }} />
                          )}
                          <span className="thumb-badge font-mono text-[11px] px-1.5 py-0.5 rounded relative z-[1]">{formatDuration(a.duration_sec)}</span>
                        </div>
                        <div className="p-3.5 flex-1 flex flex-col justify-center min-h-[64px]">
                          <p className="text-[13px] font-semibold truncate mb-2">{a.name}</p>
                          <span className="text-[11px] text-th-faint font-mono">{formatSize(a.size_bytes)}</span>
                        </div>
                      </Link>
                    ))}
                    <button
                      onClick={() => setShowUploadCustom(true)}
                      className="flex flex-col h-full rounded-th-lg border-2 border-dashed border-th-border text-th-muted hover:border-th-accent hover:text-th-accent-text transition-colors btn-press overflow-hidden">
                      <div className="aspect-video shrink-0 flex items-center justify-center">
                        <Upload size={20} />
                      </div>
                      <div className="p-3.5 flex-1 flex items-center justify-center min-h-[64px]">
                        <span className="text-[12px] font-medium">Upload cut</span>
                      </div>
                    </button>
                  </div>
                )}
              </section>

              <div className="h-px bg-th-border shrink-0" />

              {/* Board Cut */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[13px] font-bold">Board Cut</h2>
                    <span className="font-mono text-[10px] text-th-faint">{boardAssets.length}</span>
                  </div>
                  <button
                    onClick={() => setShowUploadBoard(true)}
                    className="flex items-center gap-1.5 h-8 px-3.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity">
                    <Upload size={13} /> Upload
                  </button>
                </div>

                {boardAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                    <div className="text-5xl"><Video size={48} style={{ color: 'var(--th-accent-text)' }} /></div>
                    <div>
                      <p className="font-semibold mb-1">No assets yet</p>
                      <p className="text-[13px] text-th-muted">Upload your first cut to start reviewing.</p>
                    </div>
                    <button
                      onClick={() => setShowUploadBoard(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press">
                      <Upload size={14} /> Upload first cut
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                    {boardAssets.map((a) => {
                      const isPlaceholder = !a.mux_upload_id
                      return (
                      <Link key={a.id} href={`/review/${a.id}`}
                        className={`group relative flex flex-col h-full bg-th-surface rounded-th-lg overflow-hidden transition-colors shadow-card hover:shadow-card-hover ${isPlaceholder ? 'border border-dashed border-th-faint hover:border-th-accent' : 'border border-th-border hover:border-th-accent'}`}>
                        {!isPlaceholder && (
                          <button
                            onClick={(e) => handleDeleteAsset(e, a.id)}
                            className="absolute top-2.5 left-2.5 p-1.5 rounded-th-sm bg-th-bg/70 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:text-th-changes z-20">
                            <Trash2 size={13} />
                          </button>
                        )}
                        {isPlaceholder ? (
                          <div className="aspect-video shrink-0 bg-th-surface-alt/40 flex flex-col items-center justify-center gap-2 relative">
                            <Clock size={26} className="text-th-muted" />
                            <span className="font-mono text-[10px] uppercase tracking-wider text-th-muted">Awaiting upload</span>
                          </div>
                        ) : (
                          <div className="aspect-video shrink-0 bg-th-surface-alt flex flex-col items-center justify-center gap-2 relative">
                            {a.mux_playback_id ? (
                              <img
                                src={`https://image.mux.com/${a.mux_playback_id}/thumbnail.jpg?time=1`}
                                className="w-full h-full object-cover absolute inset-0"
                                alt={a.name}
                              />
                            ) : (
                              <Film size={28} style={{ color: 'var(--th-accent-text)' }} />
                            )}
                            <span className="thumb-badge font-mono text-[11px] px-1.5 py-0.5 rounded relative z-[1]">{formatDuration(a.duration_sec)}</span>
                            <div className="thumb-badge absolute top-2.5 left-10 font-mono text-[10px] px-1.5 py-0.5 rounded z-[1]">
                              v{a.version}
                            </div>
                            <div className="thumb-badge absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-th-full font-mono z-[1]">
                              <span
                                className="thumb-badge-dot"
                                style={{
                                  background: a.status === 'approved' ? 'var(--th-resolved)' : a.status === 'changes' ? 'var(--th-changes)' : 'var(--th-open)',
                                }}
                              />
                              {a.status === 'approved' ? 'APPROVED'
                                : a.status === 'changes' ? 'NEEDS CHANGES'
                                  : a.status === 'processing' ? 'PROCESSING'
                                    : 'IN REVIEW'}
                            </div>
                          </div>
                        )}
                        <div className="p-3.5 flex-1 flex flex-col justify-center min-h-[64px]">
                          <p className="text-[13px] font-semibold truncate mb-2">{a.name}</p>
                          <div className="flex items-center justify-between text-[11px] text-th-faint font-mono">
                            <span>{formatSize(a.size_bytes)}</span>
                            {isPlaceholder ? (
                              <span className="px-2 py-0.5 rounded-th-full font-sans font-semibold text-[10px] bg-th-surface-alt border border-dashed border-th-faint text-th-muted">
                                Requested
                              </span>
                            ) : a.is_complete ? (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-th-full font-sans font-semibold text-[10px]"
                                style={{ color: 'var(--th-resolved)', background: 'color-mix(in srgb, var(--th-resolved) 14%, transparent)' }}>
                                <CheckCircle2 size={11} /> Complete
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-th-full font-sans font-semibold text-[10px] bg-th-surface-alt border border-th-border text-th-muted">
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                      )
                    })}
                    <button
                      onClick={() => setShowUploadBoard(true)}
                      className="flex flex-col h-full rounded-th-lg border-2 border-dashed border-th-border text-th-muted hover:border-th-accent hover:text-th-accent-text transition-colors btn-press overflow-hidden">
                      <div className="aspect-video shrink-0 flex items-center justify-center">
                        <Upload size={20} />
                      </div>
                      <div className="p-3.5 flex-1 flex items-center justify-center min-h-[64px]">
                        <span className="text-[12px] font-medium">Upload cut</span>
                      </div>
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Raw Footage */}
          {tab === 'raw-footage' && project?.viewer_is_admin && (
            <RawFootageArchive projectId={params.id} token={token} />
          )}

          {/* Brief */}
          {tab === 'brief' && project && (
            <BriefTab project={project} token={token} onSaved={setProject} />
          )}

          {/* Members */}
          {tab === 'members' && (
            <div className="max-w-lg mx-auto">
              <div className="bg-th-surface rounded-th border border-th-border overflow-hidden mb-4">
                {project?.owner && (
                  <div className="flex items-center gap-3.5 px-5 py-3.5 border-b border-th-border">
                    <Avatar initials={project.owner.name?.[0]?.toUpperCase() ?? 'U'} color={project.owner.avatar_color} size="md" />
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold">{project.owner.name}</p>
                      <p className="text-[11px] text-th-muted">{project.owner.email}</p>
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-th-full bg-th-surface-alt border border-th-border text-th-muted">Owner</span>
                  </div>
                )}

                {(project?.members ?? []).map((member) => (
                  <div key={member.id} className="flex items-center gap-3.5 px-5 py-3.5 border-b border-th-border last:border-b-0">
                    <Avatar initials={member.name?.[0]?.toUpperCase() ?? 'U'} color={member.avatar_color} size="md" />
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold">{member.name}</p>
                      <p className="text-[11px] text-th-muted">{member.email}</p>
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-th-full bg-th-surface-alt border border-th-border text-th-muted">Editor</span>
                  </div>
                ))}

                {!project?.owner && (project?.members ?? []).length === 0 && (
                  <div className="px-5 py-8 text-center text-[13px] text-th-muted">No members yet.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}