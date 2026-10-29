'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Orb } from '@/components/ui/Orb'
import { useSessionGuard } from '@/lib/useSessionGuard'
import { usePolling, sameData } from '@/lib/usePolling'
import { cn } from '@/lib/utils'

const MAX_LENGTH = 2000

interface Channel { key: string; label: string; unread: number }
interface Workspace { id: string; name: string; role: string; channels: Channel[] }
interface ChatMessage { id: string; body: string; created_at: string; sender_id: string; sender_name: string; mine: boolean }

const AVATAR_COLORS = ['#2F8F83', '#4F6BD8', '#B5528A', '#C27A2C', '#7A5BC0', '#3A8DBF', '#B8483F', '#5E8A3A']
const GROUP_WINDOW_MS = 5 * 60 * 1000

// Deterministic per sender (not profiles.avatar_color, which defaults to the same green for everyone).
function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

function Avatar({ name, seed }: { name: string; seed: string }) {
  return (
    <span
      aria-hidden
      className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
      style={{ background: avatarColor(seed) }}
    >
      {initialsOf(name)}
    </span>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`
}

export default function ChatPage() {
  const { ready } = useSessionGuard()
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [channel, setChannel] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const lastReadMarker = useRef<string | null>(null)
  const activeRef = useRef<string | null>(null)
  activeRef.current = activeId
  const channelRef = useRef('')
  channelRef.current = channel
  const messageRequestId = useRef(0)
  const workspaceRequestId = useRef(0)
  const [convoVersion, setConvoVersion] = useState(0)

  // Workspaces (with their channels + unread counts). Rarely more than one
  // workspace; if so, a switcher shows. Polled so new client channels and
  // unread dots on other channels appear without a reload.
  const loadWorkspaces = useCallback(async () => {
    const requestId = ++workspaceRequestId.current
    try {
      const res = await fetch('/api/chat/conversations')
      const data = await res.json().catch(() => ({}))
      if (workspaceRequestId.current !== requestId) return // superseded by a newer refresh
      if (!res.ok) {
        setSetupError(data.error ?? 'Could not load chat.')
      } else {
        const list: Workspace[] = data.workspaces ?? []
        setSetupError(null)
        setWorkspaces((prev) => (sameData(prev, list) ? prev : list))
        setActiveId((cur) => (cur && list.some((w) => w.id === cur) ? cur : list[0]?.id ?? null))
        // Drop a stale channel selection (e.g. the client's last project was trashed).
        const ws = list.find((w) => w.id === (activeRef.current ?? list[0]?.id))
        if (ws && !ws.channels.some((c) => c.key === channelRef.current)) setChannel('')
      }
    } catch {
      if (workspaceRequestId.current === requestId) setSetupError('Could not load chat.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (ready) loadWorkspaces()
  }, [ready, convoVersion, loadWorkspaces])
  usePolling(loadWorkspaces, 8000, ready)

  const markRead = useCallback(async (workspaceId: string, ch: string, list: ChatMessage[]) => {
    const latestOther = [...list].reverse().find((m) => !m.mine)
    if (!latestOther || lastReadMarker.current === `${workspaceId}:${ch}:${latestOther.id}`) return
    const key = `${workspaceId}:${ch}:${latestOther.id}`
    lastReadMarker.current = key
    try {
      const res = await fetch('/api/chat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, channel: ch, lastReadId: latestOther.id }),
      })
      if (!res.ok) throw new Error('read failed')
      window.dispatchEvent(new Event('chat:updated'))
      setConvoVersion((v) => v + 1)
    } catch {
      // Let the next poll retry instead of staying marked as done.
      if (lastReadMarker.current === key) lastReadMarker.current = null
    }
  }, [])

  const fetchMessages = useCallback(async () => {
    const workspaceId = activeRef.current
    const ch = channelRef.current
    if (!workspaceId) return
    const requestId = ++messageRequestId.current
    const res = await fetch(`/api/chat/messages?workspaceId=${workspaceId}&channel=${encodeURIComponent(ch)}`)
    if (!res.ok) return
    const data = await res.json()
    if (activeRef.current !== workspaceId || channelRef.current !== ch || messageRequestId.current !== requestId) return // switched conversation mid-flight
    const next: ChatMessage[] = data.messages ?? []
    setMessages((prev) => (sameData(prev, next) ? prev : next))
    if (document.visibilityState === 'visible') markRead(workspaceId, ch, next)
  }, [markRead])

  // Switching conversation: reset, load immediately.
  useEffect(() => {
    if (!activeId) return
    setMessages([])
    setSendError(null)
    stickToBottom.current = true
    lastReadMarker.current = null
    fetchMessages().catch(() => {})
  }, [activeId, channel, fetchMessages])

  // Same live-update layer as the board/notifications: pauses on hidden tabs.
  usePolling(fetchMessages, 5000, !!activeId)

  // Auto-scroll on new messages, but only if the user hasn't scrolled up.
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  const onScroll = () => {
    const el = scrollRef.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const send = async () => {
    const text = draft.trim()
    if (!text || !activeId || sending) return
    const draftAtSend = draft
    setSending(true)
    setSendError(null)
    let released = false
    const release = () => { if (!released) { released = true; setSending(false) } }
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: activeId, channel, body: text }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSendError(data.error ?? 'Message could not be sent.')
      } else {
        // Keep anything typed while the request was in flight.
        setDraft((current) => (current === draftAtSend ? '' : current))
        stickToBottom.current = true
        release() // the POST is done; don't block the composer on the refresh
        try {
          await fetchMessages()
        } catch {
          // The POST already committed; polling will refresh the conversation.
        }
        window.dispatchEvent(new Event('chat:updated'))
      }
    } catch {
      setSendError('Message could not be sent.')
    }
    release()
  }

  const active = workspaces?.find((w) => w.id === activeId)

  const workspaceControl =
    workspaces && workspaces.length > 1 ? (
      <select
        value={activeId ?? ''}
        onChange={(e) => { setActiveId(e.target.value); setChannel('') }}
        aria-label="Workspace"
        className="max-w-[220px] truncate rounded-th-sm border border-th-border bg-th-surface px-2 py-1 text-[12px]"
      >
        {workspaces.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    ) : active ? (
      <span className="text-[13px] font-semibold truncate">{active.name}</span>
    ) : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <TopBar title="Chat" icon={MessageCircle} />

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Orb state="composing" size={64} label="Loading" /></div>
      ) : setupError ? (
        <div className="flex-1 p-6 flex items-center justify-center">
          <EmptyState icon={MessageCircle} title="Chat unavailable" sub={setupError} />
        </div>
      ) : !activeId ? (
        <div className="flex-1 p-6 flex items-center justify-center">
          <EmptyState icon={MessageCircle} title="No workspace yet" sub="Join or create a workspace to chat with your team." />
        </div>
      ) : (
        <>
          {/* Header + channel tabs: same bounded column as the messages and composer. */}
          <div className="shrink-0 border-b border-th-border">
            <div className="w-full max-w-3xl mx-auto px-3 sm:px-6">
              <div className="py-2.5 flex items-center gap-2 min-w-0">{workspaceControl}</div>
              {active && active.channels.length > 1 && (
                <div role="tablist" aria-label="Channels" className="flex gap-1.5 overflow-x-auto pb-2">
                  {active.channels.map((c) => (
                    <button
                      key={c.key || 'general'}
                      role="tab"
                      aria-selected={c.key === channel}
                      onClick={() => setChannel(c.key)}
                      className={cn(
                        'shrink-0 flex items-center gap-1.5 rounded-th-full px-3 py-1 text-[12px] transition-colors',
                        c.key === channel ? 'bg-th-accent text-th-accent-fg font-semibold' : 'text-th-muted hover:bg-th-surface-alt',
                      )}
                    >
                      {c.label}
                      {c.unread > 0 && c.key !== channel && (
                        <>
                          <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-th-accent" />
                          <span className="sr-only">{`, ${c.unread > 99 ? '99+' : c.unread} unread`}</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto py-4">
            <div className="w-full max-w-3xl mx-auto px-3 sm:px-6">
              {messages.length === 0 ? (
                <p className="text-center text-[13px] text-th-muted pt-10">No messages yet. Say hello to your team.</p>
              ) : (
                messages.map((m, i) => {
                  const prev = messages[i - 1]
                  const grouped =
                    !!prev && prev.sender_id === m.sender_id &&
                    new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_WINDOW_MS
                  const name = m.sender_name || 'Unknown member'
                  return (
                    <div key={m.id} className={cn('flex gap-2', m.mine && 'flex-row-reverse', grouped ? 'mt-0.5' : i === 0 ? '' : 'mt-3')}>
                      {grouped ? <span className="w-8 shrink-0" /> : <Avatar name={name} seed={m.sender_id} />}
                      <div className={cn('flex flex-col min-w-0 max-w-[80%]', m.mine ? 'items-end' : 'items-start')}>
                        {!grouped && (
                          <span className="px-1 mb-0.5 text-[11px] font-semibold text-th-muted truncate max-w-full">
                            {m.mine ? `You (${name})` : name}
                          </span>
                        )}
                        <div
                          className={cn(
                            'rounded-th-lg px-3 py-2 text-[13px] whitespace-pre-wrap break-words max-w-full',
                            m.mine ? 'bg-th-accent text-th-accent-fg' : 'bg-th-surface-alt border border-th-border',
                          )}
                        >
                          {m.body}
                          <span className={cn('block mt-1 text-[10px] font-mono', m.mine ? 'text-right opacity-70' : 'text-th-faint')}>
                            {formatTime(m.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-th-border py-3">
            <div className="w-full max-w-3xl mx-auto px-3 sm:px-6">
              {sendError && <p role="alert" className="mb-2 text-[12px] text-th-changes">{sendError}</p>}
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  maxLength={MAX_LENGTH}
                  rows={1}
                  placeholder="Message your team (Enter to send, Shift+Enter for a new line)"
                  aria-label="Message"
                  className="flex-1 resize-none max-h-32 rounded-th-sm border border-th-border bg-th-surface px-3 py-2 text-[13px] outline-none focus:border-th-accent"
                />
                <button
                  onClick={send}
                  disabled={!draft.trim() || sending}
                  aria-label="Send message"
                  className="h-9 w-9 shrink-0 rounded-th-sm bg-th-accent text-th-accent-fg flex items-center justify-center disabled:opacity-40 transition-opacity"
                >
                  <Send size={15} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
