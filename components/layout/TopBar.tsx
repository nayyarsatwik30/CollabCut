'use client'

import { ThemeToggle } from '@/components/layout/ThemeToggle'

interface TopBarProps {
  title: string
  icon?: React.ElementType
  /** Rendered before the title (e.g. a Back button). */
  before?: React.ReactNode
  /** Rendered right after the title, filling the free space (e.g. version/status chips). */
  leading?: React.ReactNode
  /** Page-specific actions, rendered left of the theme toggle. */
  children?: React.ReactNode
  /** @deprecated No-op: account and notification controls now live in the sidebar. */
  showAccount?: boolean
}

export function TopBar({ title, icon: Icon, before, leading, children }: TopBarProps) {
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
        <ThemeToggle />
      </div>
    </div>
  )
}
