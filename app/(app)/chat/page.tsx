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

interface Conversation { id: string; name: string; role: string; unread: number }
interface ChatMessage { id: string; body: string; created_at: string; sender_id: string; sender_name: string; mine: boolean }

function formatTime(iso: string) {
  const d = new Date(iso)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`
}

export default function ChatPage() {
  const { ready } = useSessionGuard()
  const [conversations, setConversations] = useState<Conversation[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
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

  // Workspaces the user belongs to. Rarely more than one; if so, a switcher shows.
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/chat/conversations')
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setSetupError(data.error ?? 'Could not load chat.')
        } else {
          const list: Conversation[] = data.conversations ?? []
          setConversations(list)
          setActiveId((cur) => cur ?? list[0]?.id ?? null)
        }
      } catch {
        if (!cancelled) setSetupError('Could not load chat.')
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ready])

  const markRead = useCallback(async (workspaceId: string, list: ChatMessage[]) => {
    const latestOther = [...list].reverse().find((m) => !m.mine)
    if (!latestOther || lastReadMarker.current === `${workspaceId}:${latestOther.id}`) return
    lastReadMarker.current = `${workspaceId}:${latestOther.id}`
    try {
      await fetch('/api/chat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      })
      window.dispatchEvent(new Event('chat:updated'))
    } catch {}
  }, [])

  const fetchMessages = useCallback(async () => {
    const workspaceId = activeRef.current
    if (!workspaceId) return
    const res = await fetch(`/api/chat/messages?workspaceId=${workspaceId}`)
    if (!res.ok) return
    const data = await res.json()
    if (activeRef.current !== workspaceId) return // switched conversation mid-flight
    const next: ChatMessage[] = data.messages ?? []
    setMessages((prev) => (sameData(prev, next) ? prev : next))
    if (document.visibilityState === 'visible') markRead(workspaceId, next)
  }, [markRead])

  // Switching conversation: reset, load immediately.
  useEffect(() => {
    if (!activeId) return
    setMessages([])
    stickToBottom.current = true
    lastReadMarker.current = null
    fetchMessages().catch(() => {})
  }, [activeId, fetchMessages])

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
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: activeId, body: text }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSendError(data.error ?? 'Message could not be sent.')
      } else {
        setDraft('')
        stickToBottom.current = true
        await fetchMessages()
        window.dispatchEvent(new Event('chat:updated'))
      }
    } catch {
      setSendError('Message could not be sent.')
    }
    setSending(false)
  }

  const active = conversations?.find((c) => c.id === activeId)

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <TopBar
        title="Chat"
        icon={MessageCircle}
        leading={
          conversations && conversations.length > 1 ? (
            <select
              value={activeId ?? ''}
              onChange={(e) => setActiveId(e.target.value)}
              aria-label="Workspace"
              className="ml-2 max-w-[220px] truncate rounded-th-sm border border-th-border bg-th-surface px-2 py-1 text-[12px]"
            >
              {conversations.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : active ? (
            <span className="ml-2 text-[12px] text-th-muted truncate">{active.name}</span>
          ) : null
        }
      />

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
          <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 ? (
              <p className="text-center text-[13px] text-th-muted pt-10">No messages yet. Say hello to your team.</p>
            ) : (
              <div className="max-w-3xl mx-auto space-y-2">
                {messages.map((m, i) => {
                  const showName = !m.mine && messages[i - 1]?.sender_id !== m.sender_id
                  return (
                    <div key={m.id} className={cn('flex flex-col', m.mine ? 'items-end' : 'items-start')}>
                      {showName && <span className="px-1 mb-0.5 text-[11px] font-semibold text-th-muted">{m.sender_name}</span>}
                      <div
                        className={cn(
                          'max-w-[75%] rounded-th-lg px-3 py-2 text-[13px] whitespace-pre-wrap break-words',
                          m.mine ? 'bg-th-accent text-th-accent-fg' : 'bg-th-surface-alt border border-th-border',
                        )}
                      >
                        {m.body}
                        <span className={cn('block mt-1 text-[10px] font-mono', m.mine ? 'text-right opacity-70' : 'text-th-faint')}>
                          {formatTime(m.created_at)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-th-border px-6 py-3">
            <div className="max-w-3xl mx-auto">
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
