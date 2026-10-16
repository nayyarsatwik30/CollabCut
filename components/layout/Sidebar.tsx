'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { LayoutGrid, SquareKanban, Clock, Bell, Settings, ChevronDown, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStorageUsage } from '@/lib/useStorageUsage'
import { StorageUsageBar } from '@/components/storage/StorageUsageBar'
import { usePolling } from '@/lib/usePolling'

const NAV_ITEMS = [
  { href: '/board', icon: SquareKanban, label: 'Board' },
  { href: '/dashboard', icon: LayoutGrid, label: 'Projects' },
  { href: '/recent', icon: Clock, label: 'Recent' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
]

const SECONDARY_ITEMS = [
  { href: '/trash', icon: Trash2, label: 'Recycle Bin' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [unreadCount, setUnreadCount] = useState(0)
  const { usedBytes, workspacePlan, loading: usageLoading } = useStorageUsage()

  const name = session?.user?.name ?? session?.user?.email ?? ''
  const email = session?.user?.email ?? ''

  useEffect(() => {
    if (status === 'authenticated') fetchUnreadCount()
  }, [status])

  // The notifications page dispatches this after marking one or all
  // notifications read, so the badge here (a separate mounted instance of
  // this component) reflects it without a full page reload.
  useEffect(() => {
    if (status !== 'authenticated') return
    const handler = () => fetchUnreadCount()
    window.addEventListener('notifications:updated', handler)
    return () => window.removeEventListener('notifications:updated', handler)
  }, [status])

  const fetchUnreadCount = async () => {
    const res = await fetch('/api/notifications/unread-count')
    if (res.ok) {
      const data = await res.json()
      // Functional update that returns the same number is a no-op render.
      setUnreadCount((prev) => (prev === (data.count ?? 0) ? prev : data.count ?? 0))
    }
  }

  // Badge picks up new notifications (e.g. a collaborator's comment) while
  // the user sits on any sidebar page - pauses when the tab is hidden.
  usePolling(fetchUnreadCount, 8000, status === 'authenticated')

  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : email[0]?.toUpperCase() ?? 'U'

  const renderItem = ({ href, icon: Icon, label }: (typeof NAV_ITEMS)[number]) => {
    const active = pathname.startsWith(href)
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          'relative flex items-center gap-2.5 px-3 py-2 rounded-th-sm text-[13px] transition-colors',
          active
            ? 'bg-th-accent/10 text-th-accent-text font-semibold'
            : 'text-th-muted hover:text-th-text hover:bg-th-surface-alt',
        )}
      >
        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-th-accent" />}
        <Icon size={16} strokeWidth={1.75} className={active ? 'text-th-accent' : ''} />
        <span className="flex-1">{label}</span>
        {href === '/notifications' && unreadCount > 0 && (
          <span className="min-w-[16px] h-4 px-1 rounded-th-full flex items-center justify-center text-[9px] font-bold shrink-0 bg-th-accent text-th-accent-fg">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>
    )
  }

  return (
    <aside className="w-[220px] h-full flex flex-col shrink-0 bg-th-sidebar border-r border-th-border">
      {/* Logo */}
      <div className="h-13 flex items-center px-5 border-b border-th-border shrink-0">
        <Link href="/board" className="flex items-center gap-2.5">
          <img src="/collabcut-mark.png" alt="CollabCut" className="w-6 h-6 object-contain shrink-0" />
          <span className="text-[17px] font-extrabold tracking-tight font-display">COLLABCUT</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2.5">
        <p className="px-3 pt-2 pb-2 text-[10px] font-semibold tracking-[0.14em] text-th-faint">MENU</p>
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => renderItem(item))}
        </div>
        <div className="my-3 border-t border-th-border" />
        <div className="space-y-0.5">
          {SECONDARY_ITEMS.map((item) => renderItem(item))}
        </div>
      </nav>

      {/* User profile */}
      <div className="p-3 border-t border-th-border shrink-0 space-y-3">
        <StorageUsageBar usedBytes={usedBytes} loading={usageLoading} variant="compact" workspacePlan={workspacePlan} />
        <Link href="/settings" className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-th-sm hover:bg-th-surface-alt transition-colors text-left">
          <div className="app-avatar w-7 h-7 text-[11px]">{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold truncate">{name || 'Loading…'}</p>
            <p className="text-[10px] text-th-muted font-mono truncate">{email}</p>
          </div>
          <ChevronDown size={13} strokeWidth={1.75} className="text-th-muted" />
        </Link>
      </div>
    </aside>
  )
}
