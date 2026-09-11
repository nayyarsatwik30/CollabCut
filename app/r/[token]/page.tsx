'use client'

import { useEffect, useRef, useState } from 'react'
import { Lock, MessageSquare, Send } from 'lucide-react'
import { VideoPlayer, VideoPlayerHandle } from '@/components/review/VideoPlayer'
import { Avatar } from '@/components/ui/Badge'
import { formatTimecode } from '@/lib/utils'

const NAME_STORAGE_KEY = 'dailies_reviewer_name'

interface ShareLinkAsset {
  id: string
  name: string
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
  asset: ShareLinkAsset
}

interface PublicComment {
  id: string
  time_sec: number
  text: string
  author_name: string
}

type LoadState = 'loading' | 'not_found' | 'expired' | 'ready'

export default function PublicReviewPage({ params }: { params: { token: string } }) {
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

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NAME_STORAGE_KEY)
      if (stored) setReviewerName(stored)
    } catch {}
  }, [])

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/share?token=${params.token}`)
      if (res.status === 404) { setState('not_found'); return }
      if (res.status === 410) { setState('expired'); return }
      if (!res.ok) { setState('not_found'); return }

      const { share_link } = await res.json()
      setShareLink(share_link)
      setState('ready')
      if (!share_link.password_protected) setUnlocked(true)
    })()
  }, [params.token])

  useEffect(() => {
    if (!unlocked || !shareLink) return
    const query = new URLSearchParams({ asset_id: shareLink.asset.id, share_token: shareLink.token })
    if (shareLink.password_protected && enteredPassword) query.set('share_password', enteredPassword)
    fetch(`/api/comments?${query.toString()}`)
      .then((res) => (res.ok ? res.json() : { comments: [] }))
      .then((data) => setComments(data.comments ?? []))
  }, [unlocked, shareLink, enteredPassword])

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
        setPasswordError('Incorrect password')
      }
    } catch {
      setPasswordError('Something went wrong - try again')
    } finally {
      setVerifying(false)
    }
  }

  const handlePostComment = async () => {
    if (!commentText.trim() || !shareLink || posting) return
    setPosting(true)
    try {
      const res = await fetch('/api/share/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: shareLink.token,
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

  const asset = shareLink.asset
  const muxSrc = asset.mux_playback_id ? `https://stream.mux.com/${asset.mux_playback_id}.m3u8` : undefined
  const videoNotReady = !asset.mux_upload_id
  const hideDownload = shareLink.downloads_disabled || shareLink.comments_only

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-th-bg">
      <header className="h-12 shrink-0 bg-th-surface border-b border-th-border flex items-center px-4">
        <span className="text-[13px] font-semibold truncate">{asset.name}</span>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
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

        <aside className="w-85 shrink-0 bg-th-surface border-l border-th-border flex flex-col overflow-hidden">
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

          <div className="p-3.5 border-t border-th-border shrink-0 bg-th-surface space-y-2">
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
    </div>
  )
}
