'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Users, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS = [
  { href: '/admin', icon: Users, label: 'Editors' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      setName(session.user.user_metadata?.name ?? session.user.email ?? 'Admin')
      setEmail(session.user.email ?? '')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : email[0]?.toUpperCase() ?? 'A'

  return (
    <aside className="w-[220px] h-full flex flex-col shrink-0 bg-th-surface border-r border-th-border">
      {/* Logo */}
      <div className="h-13 flex items-center px-5 border-b border-th-border shrink-0">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-th-accent block shrink-0" />
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
            </Link>
          )
        })}
      </nav>

      {/* User profile */}
      <div className="p-3 border-t border-th-border shrink-0 space-y-1">
        <div className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-th-sm">
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
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-th-sm text-[13px] text-th-muted hover:text-th-changes hover:bg-th-surface-alt transition-colors"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
