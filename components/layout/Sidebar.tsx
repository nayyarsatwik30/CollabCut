'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Grid3X3, Clock, Star, Bell, Settings, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOCK_ME } from '@/lib/mock-data'

const NAV_ITEMS = [
  { href: '/dashboard', icon: Grid3X3, label: 'Projects' },
  { href: '/recent',    icon: Clock,    label: 'Recent' },
  { href: '/starred',   icon: Star,     label: 'Starred' },
  { href: '/notifications', icon: Bell, label: 'Notifications', badge: 3 },
  { href: '/settings',  icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[220px] h-full flex flex-col shrink-0 bg-th-surface border-r border-th-border">
      {/* Logo */}
      <div className="h-13 flex items-center px-5 border-b border-th-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-th-accent block shrink-0" />
          <span className="text-[17px] font-extrabold tracking-tight font-display">DAILIES</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label, badge }) => {
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
              {badge && (
                <span className="text-[10px] font-bold bg-th-accent text-th-accent-fg px-1.5 py-px rounded-th-full font-mono">
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User profile */}
      <div className="p-3 border-t border-th-border shrink-0">
        <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-th-sm hover:bg-th-surface-alt transition-colors text-left">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0"
            style={{ background: MOCK_ME.avatarColor, color: '#000' }}
          >
            {MOCK_ME.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold truncate">{MOCK_ME.name}</p>
            <p className="text-[10px] text-th-muted font-mono">₹499/mo</p>
          </div>
          <ChevronDown size={13} className="text-th-muted" />
        </button>
      </div>
    </aside>
  )
}
