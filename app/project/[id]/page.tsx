'use client'

import { UploadModal } from '@/components/project/UploadModal'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Share2, Upload, UserPlus, Trash2, Video, Clapperboard, Film, CheckCircle2, X, Clock } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Avatar } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'

type Tab = 'assets' | 'members' | 'activity'

interface Project {
  id: string
  name: string
  client: string
  status: string
  emoji: string
  workspace_id?: string | null
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

export default function ProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('assets')
  const [project, setProject] = useState<Project | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadCustom, setShowUploadCustom] = useState(false)
  const [showUploadBoard, setShowUploadBoard] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteLink, setInviteLink] = useState('')

  useEffect(() => {
    loadData()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/auth/login')
    })

    return () => listener.subscription.unsubscribe()
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



  const sendInvite = async () => {
    setInviteError('')
    setInviteLink('')
    if (!inviteEmail.trim()) {
      setInviteError('Enter an email address')
      return
    }
    if (!project?.workspace_id) {
      setInviteError('This project isn\'t linked to a workspace yet')
      return
    }

    setSendingInvite(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setInviteError('Your session expired. Please log in again.')
      setSendingInvite(false)
      return
    }

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ workspace_id: project.workspace_id, email: inviteEmail.trim(), role: 'editor' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInviteError(data.error ?? 'Failed to send invite')
      } else {
        setInviteLink(data.url)
        setInviteEmail('')
      }
    } catch (err) {
      setInviteError('Failed to send invite')
    }
    setSendingInvite(false)
  }

  const handleDeleteAsset = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this asset?')) return
    await fetch(`/api/assets/${id}/delete`, { method: 'POST' })
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
          <div className="ml-auto flex items-center gap-2.5">

            <button className="flex items-center gap-1.5 h-8 px-3.5 rounded-th bg-th-surface-alt border border-th-border text-[13px] text-th-text btn-press">
              <Share2 size={13} /> Share
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
                            <Film size={28} style={{ color: 'var(--th-accent)' }} />
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
                      className="flex flex-col h-full rounded-th-lg border-2 border-dashed border-th-border text-th-muted hover:border-th-accent hover:text-th-accent transition-colors btn-press overflow-hidden">
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
                    <div className="text-5xl"><Video size={48} style={{ color: 'var(--th-accent)' }} /></div>
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
                              <Film size={28} style={{ color: 'var(--th-accent)' }} />
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
                      className="flex flex-col h-full rounded-th-lg border-2 border-dashed border-th-border text-th-muted hover:border-th-accent hover:text-th-accent transition-colors btn-press overflow-hidden">
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

          {/* Members */}
          {tab === 'members' && (
            <div className="max-w-lg mx-auto">
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

              {!showInviteForm ? (
                <div className="flex justify-center">
                  <button
                    onClick={() => setShowInviteForm(true)}
                    className="flex items-center gap-2 h-9 px-4 rounded-th bg-th-surface-alt border border-th-border text-[13px] text-th-text btn-press hover:bg-th-surface-hov transition-colors"
                  >
                    <UserPlus size={14} className="text-th-muted" /> Invite reviewer
                  </button>
                </div>
              ) : (
                <div className="p-5 rounded-th-lg border border-th-border bg-th-surface space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-th-muted">Invite an editor</span>
                    <button
                      onClick={() => { setShowInviteForm(false); setInviteError(''); setInviteLink(''); setInviteEmail('') }}
                      className="p-1 rounded-th hover:bg-th-surface-alt text-th-muted hover:text-th-text transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {inviteError && (
                    <div className="px-4 py-3 rounded-th bg-th-changes/10 border border-th-changes/40 text-th-changes text-[13px]">
                      {inviteError}
                    </div>
                  )}

                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-th-muted mb-1.5">Email</label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="editor@studio.in"
                        onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
                        className="w-full px-3.5 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[14px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors"
                      />
                    </div>
                    <button
                      onClick={sendInvite}
                      disabled={sendingInvite}
                      className="px-5 py-2.5 rounded-th text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity disabled:opacity-50"
                      style={{ background: 'var(--th-accent)', color: 'var(--th-accent-fg)' }}
                    >
                      {sendingInvite ? 'Sending…' : 'Send invite'}
                    </button>
                  </div>

                  {inviteLink && (
                    <div className="pt-3 border-t border-th-border">
                      <span className="text-th-muted block text-[11px] font-mono uppercase mb-2">Invite link</span>
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={inviteLink}
                          onFocus={(e) => e.target.select()}
                          className="flex-1 px-3.5 py-2 rounded-th bg-th-surface-alt border border-th-border text-[13px] text-th-text outline-none"
                        />
                        <button
                          onClick={() => navigator.clipboard.writeText(inviteLink)}
                          className="px-3.5 py-2 rounded-th text-[12px] font-semibold bg-th-surface-alt border border-th-border text-th-text hover:bg-th-surface-hov transition-colors btn-press"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Activity */}
          {tab === 'activity' && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
              <div className="text-4xl"><Clapperboard size={40} style={{ color: 'var(--th-accent)' }} /></div>
              <p className="font-semibold">No activity yet</p>
              <p className="text-[13px] text-th-muted">Activity will appear here as your team reviews cuts.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}