'use client'

import { UploadModal } from '@/components/project/UploadModal'
import { RawFootageArchive } from '@/components/project/RawFootageArchive'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, FolderKanban, Upload, Trash2, Video, Film, CircleCheck, Clock } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { Avatar } from '@/components/ui/Badge'
import { ProjectPageSkeleton } from '@/components/project/ProjectPageSkeleton'
import { useSessionGuard } from '@/lib/useSessionGuard'
import { PriorityBadge } from '@/components/PriorityBadge'
import { PriorityMenu } from '@/components/PriorityMenu'
import { Toast, useToast } from '@/components/ui/Toast'
import { VersionBadge } from '@/components/board/VersionManager'

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
  priority: number
  asset_group_id?: string | null
  // Live versions in this asset's lineage; the card shows the latest one.
  version_count?: number
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
            className="px-4 py-2 text-[13px] font-semibold bg-th-accent text-th-accent-fg hover:bg-th-accent-hover transition-colors disabled:opacity-50 btn-press"
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
  const { toast, showToast, dismissToast } = useToast()

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

  // Priority edits are optimistic and may overlap a background refresh.
  // - Edits are serialized per lineage (chainRef), so requests apply in click
  //   order and `confirmed` (last server-acknowledged value) is well defined.
  // - When a lineage has no edit left in flight, the badge is set to
  //   `confirmed`: a failed edit rolls back to the newest value the server
  //   actually accepted, never to another edit's unsaved value.
  // - A refresh that overlaps an edit (edit pending, or finished after the
  //   refresh started) may carry a pre-edit value, so loadData re-applies the
  //   lineage's pending value (or `confirmed`) over it.
  // Lineage key = asset_group_id, since a new version can appear mid-refresh.
  const priorityKey = (a: { id: string; asset_group_id?: string | null }) => a.asset_group_id ?? a.id
  type PriorityEdit = { key: string; priority: number; pending: boolean; doneSeq: number }
  const priorityEditsRef = useRef<PriorityEdit[]>([])
  const confirmedPriorityRef = useRef(new Map<string, number>())
  const tokenRef = useRef<string | null>(null)
  tokenRef.current = token
  const priorityChainRef = useRef(new Map<string, Promise<void>>())
  const completionSeqRef = useRef(0)
  const refreshesInFlightRef = useRef(0)

  // Drop finished edits once nothing can still need them.
  const prunePriorityEdits = () => {
    if (refreshesInFlightRef.current === 0 && priorityEditsRef.current.every((e) => !e.pending)) {
      priorityEditsRef.current = []
    }
  }

  const loadData = async () => {
    if (!session) return
    setToken(session.access_token)

    const startSeq = completionSeqRef.current
    refreshesInFlightRef.current += 1
    try {
      const projectRes = await fetch(`/api/projects/${params.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      if (projectRes.ok) {
        const data = await projectRes.json()
        setProject(data.project)
        const fresh: Asset[] = data.project.assets ?? []
        const live = priorityEditsRef.current.filter((e) => e.pending || e.doneSeq > startSeq)
        // Untouched lineages: what the server just returned is the confirmed
        // value (e.g. after a timed-out PATCH, so a later failure rolls back
        // to what is actually stored).
        for (const a of fresh) {
          const key = priorityKey(a)
          if (!live.some((e) => e.key === key)) confirmedPriorityRef.current.set(key, a.priority)
        }
        setAssets(
          live.length === 0
            ? fresh
            : fresh.map((a) => {
                const key = priorityKey(a)
                const mine = live.filter((e) => e.key === key)
                if (mine.length === 0) return a
                const newestPending = [...mine].reverse().find((e) => e.pending)
                const value = newestPending ? newestPending.priority : confirmedPriorityRef.current.get(key)
                return value === undefined ? a : { ...a, priority: value }
              })
        )
      }
    } finally {
      refreshesInFlightRef.current -= 1
      prunePriorityEdits()
    }
    setLoading(false)
  }

  const handleDeleteAsset = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    const asset = assets.find((a) => a.id === id)
    const versionCount = asset?.version_count ?? 1
    const isBoard = asset?.cut_type === 'board'
    if (!confirm(isBoard && versionCount > 1
      ? `Delete this asset and all ${versionCount} versions? Each version moves to the Recycle Bin and can be restored individually.`
      : 'Delete this asset?')) return
    await fetch(`/api/assets/${id}/delete${isBoard ? '?scope=group' : ''}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    loadData()
  }

  // Priority is admin-only to change (editors only ever see the read-only
  // pill), kept in sync server-side across every version in the lineage -
  // see PATCH /api/assets/[id]/priority.
  const updatePriority = async (assetId: string, priority: number) => {
    const asset = assets.find((a) => a.id === assetId)
    if (!asset || asset.priority === priority) return

    const key = priorityKey(asset)
    const edit: PriorityEdit = { key, priority, pending: true, doneSeq: 0 }
    // Nothing in flight for this lineage: what is displayed is confirmed.
    if (!priorityEditsRef.current.some((e) => e.key === key && e.pending)) {
      confirmedPriorityRef.current.set(key, asset.priority)
    }
    priorityEditsRef.current.push(edit)
    setAssets((prev) => prev.map((a) => (priorityKey(a) === key ? { ...a, priority } : a)))

    const run = async () => {
      // A hung request must not block this lineage's queue forever: abort
      // after 15s. Aborting the client fetch does not cancel the server's
      // write, so a timeout is an UNKNOWN outcome: no rollback, the queue
      // moves on, and a delayed reload shows what is actually stored.
      let timedOut = false
      const controller = new AbortController()
      const timer = setTimeout(() => { timedOut = true; controller.abort() }, 15000)
      try {
        const res = await fetch(`/api/assets/${assetId}/priority`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
          body: JSON.stringify({ priority }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('priority update failed')
        confirmedPriorityRef.current.set(key, priority)
      } catch (err) {
        if (timedOut) {
          showToast("Couldn't confirm the priority change - refreshing.", 'info')
          setTimeout(() => { loadData() }, 1800)
        } else {
          showToast('Failed to update priority.', 'error')
        }
      } finally {
        clearTimeout(timer)
        edit.pending = false
        edit.doneSeq = ++completionSeqRef.current
        if (!timedOut && !priorityEditsRef.current.some((e) => e.key === key && e.pending)) {
          const confirmed = confirmedPriorityRef.current.get(key)
          if (confirmed !== undefined) {
            setAssets((prev) => prev.map((a) => (priorityKey(a) === key ? { ...a, priority: confirmed } : a)))
          }
        }
        prunePriorityEdits()
      }
    }
    const next = (priorityChainRef.current.get(key) ?? Promise.resolve()).then(run)
    priorityChainRef.current.set(key, next)
    await next
  }

  // The cards are <Link>s: PriorityMenu stops click propagation (so Board's
  // card handlers don't fire), which would also skip Link's own preventDefault
  // and let the anchor navigate. Cancel the default in the capture phase.
  const renderPriority = (a: Asset) =>
    project?.viewer_is_admin ? (
      <span className="inline-flex shrink-0" onClickCapture={(e) => e.preventDefault()}>
        <PriorityMenu value={a.priority} onChange={(p) => updatePriority(a.id, p)} size="sm" />
      </span>
    ) : (
      <PriorityBadge size="sm" priority={a.priority} />
    )

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
      <>
        <ProjectPageSkeleton />
      </>
    )
  }

  return (
    <>
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
        <TopBar title={project?.name ?? 'Project'} icon={FolderKanban}>
          {project?.client && (
            <span className="text-[12px] text-th-muted hidden md:inline">{project.client}</span>
          )}
          <Link href="/dashboard" className="flex items-center gap-1 text-[12px] text-th-muted hover:text-th-text transition-colors">
            <ChevronLeft size={13} /> Projects
          </Link>
        </TopBar>

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
                    className="flex items-center gap-1.5 h-8 px-3.5 rounded-th-full bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press hover:bg-th-accent-hover transition-colors">
                    <Upload size={13} /> Upload
                  </button>
                </div>

                {customAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-center border border-dashed border-th-border rounded-th-lg">
                    <p className="text-[13px] text-th-muted">No custom cuts yet.</p>
                    <button
                      onClick={() => setShowUploadCustom(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-th-full bg-th-accent text-th-accent-fg text-[12px] font-semibold btn-press">
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
                          className="absolute top-2.5 left-2.5 p-1.5 rounded-th-sm bg-th-bg border border-th-border opacity-0 group-hover:opacity-100 transition-opacity text-th-muted hover:text-th-changes z-20">
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
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-[13px] font-semibold truncate">{a.name}</p>
                            {renderPriority(a)}
                          </div>
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
                    className="flex items-center gap-1.5 h-8 px-3.5 rounded-th-full bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press hover:bg-th-accent-hover transition-colors">
                    <Upload size={13} /> Upload
                  </button>
                </div>

                {boardAssets.length === 0 ? (
                  <EmptyState icon={Video} title="No assets yet" sub="Upload your first cut to start reviewing.">
                    <button
                      onClick={() => setShowUploadBoard(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-th-full bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press hover:bg-th-accent-hover transition-colors">
                      <Upload size={14} /> Upload first cut
                    </button>
                  </EmptyState>
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
                            className="absolute top-2.5 left-2.5 p-1.5 rounded-th-sm bg-th-bg border border-th-border opacity-0 group-hover:opacity-100 transition-opacity text-th-muted hover:text-th-changes z-20">
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
                            {(a.version_count ?? 1) >= 2 ? (
                              <VersionBadge
                                assetId={a.id}
                                versionCount={a.version_count ?? 1}
                                token={token}
                                canManage
                                onChanged={loadData}
                                label={`v${a.version} · ${a.version_count} versions`}
                                className="thumb-badge absolute top-2.5 left-10 inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded z-[1] hover:brightness-125 transition"
                              />
                            ) : (
                              <div className="thumb-badge absolute top-2.5 left-10 font-mono text-[10px] px-1.5 py-0.5 rounded z-[1]">
                                v{a.version}
                              </div>
                            )}
                            <div className="app-pill thumb-badge absolute top-2.5 right-2.5 text-[10px] font-mono z-[1]">
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
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-[13px] font-semibold truncate">{a.name}</p>
                            {renderPriority(a)}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-th-faint font-mono">
                            <span>{formatSize(a.size_bytes)}</span>
                            {isPlaceholder ? (
                              <span className="app-pill text-[10px] bg-th-surface-alt border border-dashed border-th-faint text-th-muted">
                                Requested
                              </span>
                            ) : a.is_complete ? (
                              <span className="app-pill text-[10px]"
                                style={{ color: 'var(--th-resolved)', background: 'color-mix(in srgb, var(--th-resolved) 14%, transparent)' }}>
                                <CircleCheck size={11} /> Complete
                              </span>
                            ) : (
                              <span className="app-pill text-[10px] bg-th-surface-alt border border-th-border text-th-muted">
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
                    <span className="app-pill text-[10px] bg-th-surface-alt border border-th-border text-th-muted">Owner</span>
                  </div>
                )}

                {(project?.members ?? []).map((member) => (
                  <div key={member.id} className="flex items-center gap-3.5 px-5 py-3.5 border-b border-th-border last:border-b-0">
                    <Avatar initials={member.name?.[0]?.toUpperCase() ?? 'U'} color={member.avatar_color} size="md" />
                    <div className="flex-1">
                      <p className="text-[13px] font-semibold">{member.name}</p>
                      <p className="text-[11px] text-th-muted">{member.email}</p>
                    </div>
                    <span className="app-pill text-[10px] bg-th-surface-alt border border-th-border text-th-muted">Editor</span>
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

      <Toast toast={toast} onDismiss={dismissToast} />
    </>
  )
}