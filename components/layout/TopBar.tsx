'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Bell } from 'lucide-react'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

interface TopBarProps {
  title: string
  icon?: React.ElementType
  /** Rendered before the title (e.g. a Back button). */
  before?: React.ReactNode
  /** Rendered right after the title, filling the free space (e.g. version/status chips). */
  leading?: React.ReactNode
  /** Page-specific actions, rendered left of the shared icon cluster. */
  children?: React.ReactNode
  /** false on unauthenticated pages: hides the notifications and account links. */
  showAccount?: boolean
}

export function TopBar({ title, icon: Icon, before, leading, children, showAccount = true }: TopBarProps) {
  const { data: session } = useSession()
  const name = session?.user?.name ?? session?.user?.email ?? ''
  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="h-13 shrink-0 bg-th-bg border-b border-th-border flex items-center gap-3 px-6 relative z-30">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {before}
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={16} strokeWidth={1.75} className="shrink-0 text-th-accent-text" />}
          <h1 className="text-[15px] font-bold leading-none m-0 truncate">{title}</h1>
        </div>
        {leading}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {children}
        {showAccount && (
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="w-8 h-8 rounded-full flex items-center justify-center text-th-muted hover:text-th-text hover:bg-th-surface-alt transition-colors"
          >
            <Bell size={16} strokeWidth={1.75} />
          </Link>
        )}
        <ThemeToggle />
        {showAccount && (
          <Link href="/settings" aria-label="Account settings" className="app-avatar w-8 h-8 text-[11px]">
            {initials}
          </Link>
        )}
      </div>
    </div>
  )
}
