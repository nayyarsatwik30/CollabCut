'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, MessageSquare, UserPlus, Upload, CheckCircle2 } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { supabase } from '@/lib/supabase'

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
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/auth/login'); return }
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

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      fetch(`/api/notifications/${n.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ read: true }),
      }).catch(() => {})
    }
    if (n.link) router.push(n.link)
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
            <span className="font-mono text-[11px] text-th-muted">
              {notifications.filter((n) => !n.read).length} unread
            </span>
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
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="w-full flex items-start gap-3 px-6 py-4 border-b border-th-border text-left hover:bg-th-surface-alt transition-colors"
                  style={{ background: n.read ? 'transparent' : 'color-mix(in srgb, var(--th-accent) 6%, transparent)' }}
                >
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
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-th-accent shrink-0 mt-1.5" title="Unread" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
