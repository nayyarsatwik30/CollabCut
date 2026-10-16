'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Bell } from 'lucide-react'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

interface TopBarProps {
  title: string
  icon?: React.ElementType
  /** Page-specific actions, rendered left of the shared icon cluster. */
  children?: React.ReactNode
}

export function TopBar({ title, icon: Icon, children }: TopBarProps) {
  const { data: session } = useSession()
  const name = session?.user?.name ?? session?.user?.email ?? ''
  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="h-13 shrink-0 bg-th-bg border-b border-th-border flex items-center justify-between px-6">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon size={16} strokeWidth={1.75} className="shrink-0 text-th-accent-text" />}
        <h1 className="text-[15px] font-bold leading-none m-0 truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {children}
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="w-8 h-8 rounded-full flex items-center justify-center text-th-muted hover:text-th-text hover:bg-th-surface-alt transition-colors"
        >
          <Bell size={16} strokeWidth={1.75} />
        </Link>
        <ThemeToggle />
        <Link href="/settings" aria-label="Account settings" className="app-avatar w-8 h-8 text-[11px]">
          {initials}
        </Link>
      </div>
    </div>
  )
}
