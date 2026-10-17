'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { LayoutGrid, SquareKanban, Clock, Bell, Settings, ChevronDown, Trash2, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStorageUsage } from '@/lib/useStorageUsage'
import { StorageUsageBar } from '@/components/storage/StorageUsageBar'
import { usePolling } from '@/lib/usePolling'
import { performLogout } from '@/lib/auth'
import { ConfirmDialog, useConfirm } from '@/components/ui/ConfirmDialog'

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

const COLLAPSE_KEY = 'collabcut:sidebar-collapsed'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  // Restore the saved rail state after mount (localStorage isn't available
  // during SSR, so the first paint is always expanded).
  useEffect(() => {
    try { if (localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true) } catch {}
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch {}
      return next
    })
    setMenuOpen(false)
  }
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

  // Close the account menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const handleLogoutClick = async () => {
    setMenuOpen(false)
    const ok = await confirm({ title: 'Log out of CollabCut?', confirmLabel: 'Yes, log out' })
    if (ok) await performLogout(router)
  }

  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : email[0]?.toUpperCase() ?? 'U'

  const renderItem = ({ href, icon: Icon, label }: (typeof NAV_ITEMS)[number]) => {
    const active = pathname.startsWith(href)
    return (
      <Link
        key={href}
        href={href}
        title={collapsed ? label : undefined}
        aria-label={collapsed ? label : undefined}
        className={cn(
          'relative flex items-center py-2 rounded-th-sm text-[13px] transition-colors',
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-3',
          active
            ? 'bg-[var(--th-chrome-active)] text-white font-semibold'
            : 'text-th-muted hover:text-white hover:bg-[var(--th-chrome-hover)]',
        )}
      >
        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-white" />}
        <Icon size={16} strokeWidth={1.75} className={active ? 'text-white' : ''} />
        <span className={cn('overflow-hidden whitespace-nowrap transition-opacity duration-200', collapsed ? 'w-0 opacity-0' : 'flex-1 opacity-100')}>{label}</span>
        {href === '/notifications' && unreadCount > 0 && collapsed && (
          <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-th-accent" />
        )}
        {href === '/notifications' && unreadCount > 0 && !collapsed && (
          <span className="min-w-[16px] h-4 px-1 rounded-th-full flex items-center justify-center text-[9px] font-bold shrink-0 bg-th-accent text-th-accent-fg">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>
    )
  }

  return (
    <>
    <aside className={cn('h-full flex flex-col shrink-0 chrome transition-[width] duration-200 ease-out', collapsed ? 'w-[68px]' : 'w-[220px]')}>
      <span aria-hidden className="sidebar-seam-bottom" />
      {/* Logo + collapse toggle */}
      <div className={cn('h-13 flex items-center shrink-0', collapsed ? 'justify-center px-0' : 'px-5')}>
        <Link href="/board" className="flex items-center min-w-0">
          <span className="w-8 h-8 rounded-th-sm bg-white flex items-center justify-center shrink-0">
            <img src="/collabcut-mark.png" alt="CollabCut" className="w-6 h-6 object-contain" />
          </span>
          <span className={cn('text-[17px] font-extrabold tracking-tight font-display overflow-hidden whitespace-nowrap transition-all duration-200', collapsed ? 'w-0 ml-0 opacity-0' : 'ml-2.5 opacity-100')}>COLLABCUT</span>
        </Link>
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="ml-auto w-7 h-7 rounded-th-sm flex items-center justify-center text-th-muted hover:text-white hover:bg-[var(--th-chrome-hover)] transition-colors shrink-0"
          >
            <PanelLeftClose size={16} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2.5">
        {collapsed ? (
          <button
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mb-2 mt-1 w-full h-8 rounded-th-sm flex items-center justify-center text-th-muted hover:text-white hover:bg-[var(--th-chrome-hover)] transition-colors"
          >
            <PanelLeftOpen size={16} strokeWidth={1.75} />
          </button>
        ) : (
          <p className="px-3 pt-2 pb-2 text-[10px] font-semibold tracking-[0.14em] text-th-faint">MENU</p>
        )}
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
        {!collapsed && (
          <StorageUsageBar usedBytes={usedBytes} loading={usageLoading} variant="compact" workspacePlan={workspacePlan} />
        )}
        <div ref={menuRef} className="relative">
          {menuOpen && (
            <div
              role="menu"
              className={cn('absolute bottom-full left-0 mb-1.5 p-1 rounded-th-sm border border-th-border bg-th-chrome-raised shadow-lg z-40', collapsed ? 'min-w-[150px]' : 'right-0')}
            >
              <button
                role="menuitem"
                onClick={handleLogoutClick}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-th-sm text-[13px] text-th-muted hover:text-th-changes hover:bg-[var(--th-chrome-hover)] transition-colors text-left"
              >
                <LogOut size={14} strokeWidth={1.75} /> Logout
              </button>
            </div>
          )}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={collapsed ? name || email : undefined}
            className={cn('w-full flex items-center py-2 rounded-th-sm hover:bg-[var(--th-chrome-hover)] transition-colors text-left', collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5')}
          >
            <div className="app-avatar w-7 h-7 text-[11px]">{initials}</div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate">{name || 'Loading…'}</p>
                <p className="text-[10px] text-th-muted font-mono truncate">{email}</p>
              </div>
            )}
            {!collapsed && <ChevronDown size={13} strokeWidth={1.75} className={cn('text-th-muted transition-transform', menuOpen && 'rotate-180')} />}
          </button>
        </div>
      </div>
    </aside>
      <ConfirmDialog state={confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </>
  )
}
