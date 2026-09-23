'use client'

import { useEffect, useRef, useState } from 'react'
import { Lock, MessageSquare, Send, Layers, ChevronDown, Check, X } from 'lucide-react'
import { VideoPlayer, VideoPlayerHandle } from '@/components/review/VideoPlayer'
import { Avatar } from '@/components/ui/Badge'
import { formatTimecode } from '@/lib/utils'

const NAME_STORAGE_KEY = 'dailies_reviewer_name'

interface ShareLinkVersion {
  id: string
  version: number
  name: string
  status: string
  created_at: string
  size_bytes: number
  mux_playback_id: string | null
  mux_upload_id: string | null
  is_complete: boolean
}

interface ShareLinkData {
  token: string
  expires_at: string | null
  downloads_disabled: boolean
  comments_only: boolean
  password_protected: boolean
  default_version_id: string
  versions: ShareLinkVersion[]
  asset: ShareLinkVersion
}

interface PublicComment {
  id: string
  time_sec: number
  text: string
  author_name: string
}

type LoadState = 'loading' | 'not_found' | 'expired' | 'ready'

export default function PublicReviewClient({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>('loading')
  const [shareLink, setShareLink] = useState<ShareLinkData | null>(null)

  const [unlocked, setUnlocked] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [enteredPassword, setEnteredPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [verifying, setVerifying] = useState(false)

  const [comments, setComments] = useState<PublicComment[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const videoPlayerRef = useRef<VideoPlayerHandle>(null)

  const [reviewerName, setReviewerName] = useState('')
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)

  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [showVersions, setShowVersions] = useState(false)
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [compareV1Id, setCompareV1Id] = useState('')
  const [compareV2Id, setCompareV2Id] = useState('')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NAME_STORAGE_KEY)
      if (stored) setReviewerName(stored)
    } catch {}
  }, [])

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/share?token=${token}`)
      if (res.status === 404) { setState('not_found'); return }
      if (res.status === 410) { setState('expired'); return }
      if (!res.ok) { setState('not_found'); return }

      const { share_link } = await res.json()
      setShareLink(share_link)
      setSelectedVersionId(share_link.default_version_id)
      setState('ready')
      if (!share_link.password_protected) setUnlocked(true)
    })()
  }, [token])

  // generateMetadata() sets the real title server-side for open links, but
  // deliberately stays generic for password-protected ones (so a crawler
  // or link preview never leaks the name before anyone unlocks it) - once
  // this tab itself has unlocked, update the live browser tab title to
  // match the heading below instead of leaving it stuck on the generic
  // string for the rest of the session.
  useEffect(() => {
    if (unlocked && shareLink) document.title = `${shareLink.asset.name} — CollabCut`
  }, [unlocked, shareLink])

  useEffect(() => {
    if (!unlocked || !shareLink || !selectedVersionId) return
    const query = new URLSearchParams({ asset_id: selectedVersionId, share_token: shareLink.token })
    if (shareLink.password_protected && enteredPassword) query.set('share_password', enteredPassword)
    fetch(`/api/comments?${query.toString()}`)
      .then((res) => (res.ok ? res.json() : { comments: [] }))
      .then((data) => setComments(data.comments ?? []))
  }, [unlocked, shareLink, enteredPassword, selectedVersionId])

  const handleUnlock = async () => {
    if (!passwordInput.trim() || !shareLink) return
    setVerifying(true)
    setPasswordError('')
    try {
      const res = await fetch('/api/share/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: shareLink.token, password: passwordInput }),
      })
      const data = await res.json()
      if (res.ok && data.valid) {
        setEnteredPassword(passwordInput)
        setUnlocked(true)
      } else {
        setPasswordError(res.status === 404 ? 'This link no longer exists' : res.status === 410 ? 'This link has expired' : res.ok ? 'Incorrect password' : 'Something went wrong - try again')
      }
    } catch {
      setPasswordError('Something went wrong - try again')
    } finally {
      setVerifying(false)
    }
  }

  const handlePostComment = async () => {
    if (!commentText.trim() || !shareLink || !selectedVersionId || posting) return
    setPosting(true)
    try {
      const res = await fetch('/api/share/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: shareLink.token,
          asset_id: selectedVersionId,
          time_sec: currentTime,
          text: commentText.trim(),
          author_name: reviewerName.trim() || 'Anonymous',
          password: shareLink.password_protected ? enteredPassword : undefined,
        }),
      })
      if (res.ok) {
        const { comment } = await res.json()
        setComments((prev) => [...prev, comment].sort((a, b) => a.time_sec - b.time_sec))
        setCommentText('')
        try { localStorage.setItem(NAME_STORAGE_KEY, reviewerName.trim() || 'Anonymous') } catch {}
      }
    } finally {
      setPosting(false)
    }
  }

  const handleSwitchVersion = (id: string) => {
    setShowVersions(false)
    if (!shareLink || id === selectedVersionId) return
    setSelectedVersionId(id)
    setCurrentTime(0)
  }

  const handleOpenCompare = () => {
    if (!shareLink) return
    if (shareLink.versions.length >= 2) {
      setCompareV1Id(shareLink.versions[0].id)
      setCompareV2Id(shareLink.versions[1].id)
    }
    setShowCompareModal(true)
  }

  if (state === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-th-bg">
        <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
      </div>
    )
  }

  if (state === 'not_found') {
    return (
      <div className="flex h-screen items-center justify-center bg-th-bg text-center px-6">
        <div>
          <p className="text-[15px] font-semibold mb-1">This link isn't valid</p>
          <p className="text-[13px] text-th-muted">Double-check the URL, or ask for a new share link.</p>
        </div>
      </div>
    )
  }

  if (state === 'expired') {
    return (
      <div className="flex h-screen items-center justify-center bg-th-bg text-center px-6">
        <div>
          <p className="text-[15px] font-semibold mb-1">This link has expired</p>
          <p className="text-[13px] text-th-muted">Ask the project owner for a new share link.</p>
        </div>
      </div>
    )
  }

  if (!shareLink) return null

  if (!unlocked) {
    return (
      <div className="flex h-screen items-center justify-center bg-th-bg px-6">
        <div className="w-full max-w-sm text-center">
          <Lock size={22} className="mx-auto mb-3 text-th-muted" />
          <p className="text-[15px] font-semibold mb-1">Password required</p>
          <p className="text-[13px] text-th-muted mb-4">This review link is password-protected.</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            placeholder="Enter password"
            autoFocus
            className="w-full px-3 py-2.5 rounded-th-sm bg-th-surface-alt border border-th-border text-[13px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors mb-2"
          />
          {passwordError && <p className="text-[12px] text-th-changes mb-2">{passwordError}</p>}
          <button
            onClick={handleUnlock}
            disabled={verifying || !passwordInput.trim()}
            className="w-full py-2.5 rounded-th-sm bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {verifying ? 'Checking…' : 'Unlock'}
          </button>
        </div>
      </div>
    )
  }

  const versions = shareLink.versions
  const asset = versions.find((v) => v.id === selectedVersionId) ?? shareLink.asset
  const muxSrc = asset.mux_playback_id ? `https://stream.mux.com/${asset.mux_playback_id}.m3u8` : undefined
  const videoNotReady = !asset.mux_upload_id
  const hideDownload = shareLink.downloads_disabled || shareLink.comments_only

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-th-bg">
      <header className="h-12 shrink-0 bg-th-surface border-b border-th-border flex items-center gap-2 px-4">
        <span className="text-[13px] font-semibold truncate">{asset.name}</span>

        {versions.length > 1 && (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="flex items-center gap-1.5 h-6 px-2.5 rounded-th-full bg-th-surface-alt border border-th-border font-mono text-[11px] text-th-muted hover:text-th-text transition-colors btn-press"
            >
              <Layers size={10} />
              v{asset.version}
              <ChevronDown size={10} />
            </button>

            {showVersions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowVersions(false)} />
                <div className="absolute left-0 top-full mt-1.5 z-50 bg-th-surface border border-th-border rounded-th-lg shadow-panel w-60 overflow-hidden animate-slide-up">
                  <div className="px-4 py-2.5 border-b border-th-border font-mono text-[10px] text-th-muted uppercase tracking-wider">
                    Version history
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {versions.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => handleSwitchVersion(v.id)}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-left border-b border-th-border last:border-b-0 hover:bg-th-surface-alt transition-colors btn-press"
                      >
                        <Layers size={12} style={{ color: v.id === asset.id ? 'var(--th-accent-text)' : 'var(--th-muted)' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium truncate" style={{ color: v.id === asset.id ? 'var(--th-accent-text)' : 'var(--th-text)' }}>
                            v{v.version}
                          </p>
                          <p className="font-mono text-[10px] text-th-muted">{new Date(v.created_at).toLocaleDateString()}</p>
                        </div>
                        {v.id === asset.id && <Check size={12} className="text-th-accent-text shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {versions.length >= 2 && (
          <button
            onClick={handleOpenCompare}
            className="flex items-center gap-1.5 h-6 px-2.5 rounded-th-full bg-th-surface-alt border border-th-border font-mono text-[11px] text-th-muted hover:text-th-text transition-colors btn-press shrink-0"
          >
            <Layers size={10} className="text-th-accent-text" />
            Compare versions
          </button>
        )}
      </header>

      <div className="flex flex-col flex-1 overflow-hidden min-h-0 sm:flex-row">
        <div className="w-full h-[38vh] shrink-0 flex flex-col overflow-hidden sm:w-auto sm:h-auto sm:flex-1 sm:min-w-0">
          {videoNotReady ? (
            <div className="flex-1 flex items-center justify-center bg-black">
              <p className="text-white/60 text-[13px]">This video isn't available yet.</p>
            </div>
          ) : (
            <VideoPlayer
              ref={videoPlayerRef}
              src={muxSrc}
              comments={comments.map((c) => ({ id: c.id, timeSec: c.time_sec, status: 'open', text: c.text, resolved: false })) as any}
              onTimeUpdate={setCurrentTime}
              approved={asset.is_complete}
              hideDownload={hideDownload}
            />
          )}
        </div>

        <aside className="w-full flex-1 min-h-0 border-t border-th-border bg-th-surface flex flex-col overflow-hidden sm:w-85 sm:flex-none sm:border-t-0 sm:border-l">
          <div className="h-11 shrink-0 border-b border-th-border flex items-center gap-1.5 px-4 text-[12px] font-semibold">
            <MessageSquare size={13} className="text-th-muted" /> Comments ({comments.length})
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                <MessageSquare size={24} className="text-th-faint" />
                <p className="text-[12px] text-th-muted">Pause on a frame and leave the first note.</p>
              </div>
            ) : (
              comments.map((c) => (
                <button
                  key={c.id}
                  onClick={() => videoPlayerRef.current?.seekTo(c.time_sec)}
                  className="w-full text-left mb-3 last:mb-0 p-2.5 rounded-th-sm hover:bg-th-surface-alt transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar initials={c.author_name?.[0]?.toUpperCase() ?? '?'} color="#4CAF7D" size="sm" />
                    <span className="text-[12px] font-semibold truncate">{c.author_name}</span>
                    <span className="ml-auto font-mono text-[10px] text-th-faint">{formatTimecode(c.time_sec)}</span>
                  </div>
                  <p className="text-[12px] text-th-text pl-8 leading-relaxed">{c.text}</p>
                </button>
              ))
            )}
          </div>

          <div className="p-4 sm:p-3.5 border-t border-th-border shrink-0 bg-th-surface space-y-2">
            <input
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 rounded-th-sm bg-th-surface-alt border border-th-border text-[12px] text-th-text placeholder:text-th-faint outline-none focus:border-th-accent transition-colors"
            />
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment() } }}
              placeholder={`Note this frame at ${formatTimecode(currentTime)}…`}
              rows={3}
              className="w-full px-3 py-2.5 rounded-th bg-th-surface-alt border border-th-border text-[13px] text-th-text placeholder:text-th-faint outline-none resize-none leading-relaxed transition-colors focus:border-th-accent"
            />
            {commentText.trim() && (
              <button
                onClick={handlePostComment}
                disabled={posting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-bold btn-press hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send size={13} /> {posting ? 'Posting…' : `Post note at ${formatTimecode(currentTime)}`}
              </button>
            )}
          </div>
        </aside>
      </div>

      {showCompareModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
          <div className="glass border border-th-border rounded-th-lg w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-th-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-th-accent-text" />
                <h2 className="font-bold text-[16px]">Compare versions</h2>
              </div>
              <button
                onClick={() => setShowCompareModal(false)}
                className="text-th-muted hover:text-th-text transition-colors p-1 rounded-th hover:bg-th-surface-alt"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-6 overflow-hidden min-h-0 bg-black/40">
              <div className="flex flex-col h-full overflow-hidden card-elevated border border-th-border rounded-th-lg">
                <div className="p-3 border-b border-th-border flex items-center justify-between bg-th-surface-alt">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-th-muted font-semibold">Version A</span>
                  <select
                    value={compareV1Id}
                    onChange={(e) => setCompareV1Id(e.target.value)}
                    className="bg-th-surface border border-th-border text-th-text text-[12px] rounded-th px-2.5 py-1 outline-none focus:border-th-accent font-mono font-medium"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} ({new Date(v.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 bg-black relative overflow-hidden">
                  {(() => {
                    const selV1 = versions.find((v) => v.id === compareV1Id)
                    const v1Src = selV1?.mux_playback_id
                      ? `https://stream.mux.com/${selV1.mux_playback_id}.m3u8`
                      : undefined
                    return <VideoPlayer src={v1Src} comments={[]} hideDownload={hideDownload} />
                  })()}
                </div>
              </div>

              <div className="flex flex-col h-full overflow-hidden card-elevated border border-th-border rounded-th-lg">
                <div className="p-3 border-b border-th-border flex items-center justify-between bg-th-surface-alt">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-th-muted font-semibold">Version B</span>
                  <select
                    value={compareV2Id}
                    onChange={(e) => setCompareV2Id(e.target.value)}
                    className="bg-th-surface border border-th-border text-th-text text-[12px] rounded-th px-2.5 py-1 outline-none focus:border-th-accent font-mono font-medium"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} ({new Date(v.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 bg-black relative overflow-hidden">
                  {(() => {
                    const selV2 = versions.find((v) => v.id === compareV2Id)
                    const v2Src = selV2?.mux_playback_id
                      ? `https://stream.mux.com/${selV2.mux_playback_id}.m3u8`
                      : undefined
                    return <VideoPlayer src={v2Src} comments={[]} hideDownload={hideDownload} />
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
