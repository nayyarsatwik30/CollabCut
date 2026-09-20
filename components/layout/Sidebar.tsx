'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Grid3X3, Kanban, Clock, Bell, Settings, ChevronDown, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStorageUsage } from '@/lib/useStorageUsage'
import { StorageUsageBar } from '@/components/storage/StorageUsageBar'

const NAV_ITEMS = [
  { href: '/board', icon: Kanban, label: 'Board' },
  { href: '/dashboard', icon: Grid3X3, label: 'Projects' },
  { href: '/recent', icon: Clock, label: 'Recent' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
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
      setUnreadCount(data.count ?? 0)
    }
  }

  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : email[0]?.toUpperCase() ?? 'U'

  return (
    <aside className="w-[220px] h-full flex flex-col shrink-0 bg-th-surface border-r border-th-border">
      {/* Logo */}
      <div className="h-13 flex items-center px-5 border-b border-th-border shrink-0">
        <Link href="/board" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="CollabCut" className="w-6 h-6 rounded-md shrink-0" />
          <span className="text-[17px] font-extrabold tracking-tight font-display">COLLABCUT</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-th-sm text-[13px] transition-colors',
                active
                  ? 'bg-th-surface-alt text-th-text font-semibold'
                  : 'text-th-muted hover:text-th-text hover:bg-th-surface-alt',
              )}
            >
              <Icon size={15} className={active ? 'text-th-accent' : ''} />
              <span className="flex-1">{label}</span>
              {href === '/notifications' && unreadCount > 0 && (
                <span
                  className="min-w-[16px] h-4 px-1 rounded-th-full flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{ background: 'var(--th-accent)', color: 'var(--th-accent-fg)' }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User profile */}
      <div className="p-3 border-t border-th-border shrink-0 space-y-3">
        <StorageUsageBar usedBytes={usedBytes} loading={usageLoading} variant="compact" workspacePlan={workspacePlan} />
        <Link href="/settings" className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-th-sm hover:bg-th-surface-alt transition-colors text-left">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0"
            style={{ background: '#22D3EE', color: '#000' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold truncate">{name || 'Loading…'}</p>
            <p className="text-[10px] text-th-muted font-mono truncate">{email}</p>
          </div>
          <ChevronDown size={13} className="text-th-muted" />
        </Link>
      </div>
    </aside>
  )
}
