'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, MessageSquare, UserPlus, Upload, CheckCircle2, Check, CheckCheck } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { useSessionGuard } from '@/lib/useSessionGuard'

interface Notification {
  id: string
  type: string
  message: string
  link: string | null
  read: boolean
  created_at: string
}

const TYPE_ICON: Record<string, React.ElementType> = {
  editor_assigned: UserPlus,
  cut_uploaded: Upload,
  comment_added: MessageSquare,
  comment_reply: MessageSquare,
  version_ready: CheckCircle2,
}

export default function NotificationsPage() {
  const router = useRouter()
  const { session, ready } = useSessionGuard()
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (ready && session) load()
  }, [ready, session])

  const load = async () => {
    if (!session) return
    setToken(session.access_token)

    const res = await fetch('/api/notifications', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setNotifications(data.notifications ?? [])
    }
    setLoading(false)
  }

  // Shared by opening a notification, the per-row checkmark, and "Mark all
  // as read" - all three just PATCH the same read-state endpoint.
  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)))
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ read: true }),
      })
    } catch (err) {}
    window.dispatchEvent(new Event('notifications:updated'))
  }

  const handleClick = (n: Notification) => {
    if (!n.read) markAsRead(n.id)
    if (n.link) router.push(n.link)
  }

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read)
    if (unread.length === 0) return
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })))
    await Promise.all(
      unread.map((n) =>
        fetch(`/api/notifications/${n.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ read: true }),
        }).catch(() => {})
      )
    )
    window.dispatchEvent(new Event('notifications:updated'))
  }

  const formatTime = (iso: string) => {
    const date = new Date(iso)
    const diffMin = Math.round((Date.now() - date.getTime()) / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.round(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.round(diffHr / 24)
    if (diffDay < 7) return `${diffDay}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center justify-between px-6">
          <h1 className="text-[15px] font-bold">Notifications</h1>
          {notifications.some((n) => !n.read) && (
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-th-muted">
                {notifications.filter((n) => !n.read).length} unread
              </span>
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1.5 h-7 px-3 rounded-th bg-th-surface-alt border border-th-border text-[12px] text-th-muted hover:text-th-text hover:border-th-accent transition-colors btn-press"
              >
                <CheckCheck size={13} /> Mark all as read
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-th-accent border-t-transparent animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-3 text-center">
            <Bell size={28} className="text-th-faint" />
            <p className="font-semibold">No notifications yet</p>
            <p className="text-[13px] text-th-muted">You'll be notified when someone comments or approves a cut.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {notifications.map((n) => {
              const Icon = TYPE_ICON[n.type] ?? Bell
              return (
                <div
                  key={n.id}
                  className="w-full flex items-start gap-3 px-6 py-4 border-b border-th-border hover:bg-th-surface-alt transition-colors"
                  style={{ background: n.read ? 'transparent' : 'color-mix(in srgb, var(--th-accent) 6%, transparent)' }}
                >
                  <button onClick={() => handleClick(n)} className="flex-1 min-w-0 flex items-start gap-3 text-left">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: 'color-mix(in srgb, var(--th-accent) 16%, transparent)', color: 'var(--th-accent)' }}
                    >
                      <Icon size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] ${n.read ? 'text-th-text' : 'font-semibold text-th-text'}`}>{n.message}</p>
                      <p className="font-mono text-[10px] text-th-muted mt-1">{formatTime(n.created_at)}</p>
                    </div>
                  </button>
                  {!n.read && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      title="Mark as read"
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-1.5 text-th-accent hover:bg-th-accent hover:text-th-accent-fg transition-colors btn-press"
                      style={{ background: 'color-mix(in srgb, var(--th-accent) 16%, transparent)' }}
                    >
                      <Check size={11} strokeWidth={3} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
