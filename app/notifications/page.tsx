'use client'
import { Sidebar } from '@/components/layout/Sidebar'
import { ThemePicker } from '@/components/layout/ThemePicker'
import { Avatar } from '@/components/ui/Badge'
import { Check } from 'lucide-react'

const NOTIFS = [
  { id:'1', who:'Riya S.',        initials:'RS', color:'#E8A33D', action:'left a note on',        target:'Client Cut v3.mp4',    time:'3h ago',    read:false },
  { id:'2', who:'Client (Aditi)', initials:'CA', color:'#5BA4CF', action:'approved section in',   target:'Client Cut v3.mp4',    time:'2h ago',    read:false },
  { id:'3', who:'Riya S.',        initials:'RS', color:'#E8A33D', action:'replied to your note on',target:"Director's Cut v2",   time:'5h ago',    read:false },
  { id:'4', who:'Client (Aditi)', initials:'CA', color:'#5BA4CF', action:'opened the review for', target:'Rough Assembly v1',    time:'1d ago',    read:true  },
  { id:'5', who:'Riya S.',        initials:'RS', color:'#E8A33D', action:'uploaded a new version',target:'Flipkart Diwali TVC',  time:'2d ago',    read:true  },
]

export default function NotificationsPage() {
  const unread = NOTIFS.filter(n => !n.read).length
  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-bold">Notifications</h1>
            {unread > 0 && (
              <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 rounded-th-full"
                style={{ background:'var(--th-accent)', color:'var(--th-accent-fg)' }}>
                {unread} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button className="text-[12px] text-th-muted hover:text-th-text transition-colors flex items-center gap-1.5">
              <Check size={12} /> Mark all read
            </button>
            <ThemePicker />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto py-4">
            {NOTIFS.map((n) => (
              <div key={n.id}
                className="flex items-start gap-3.5 px-6 py-4 border-b border-th-border last:border-b-0 hover:bg-th-surface-alt transition-colors cursor-pointer"
                style={{ background: !n.read ? 'color-mix(in srgb, var(--th-accent) 4%, transparent)' : 'transparent' }}>
                <div className="relative shrink-0 mt-0.5">
                  <Avatar initials={n.initials} color={n.color} size="md" />
                  {!n.read && (
                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-th-bg"
                      style={{ background:'var(--th-accent)' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] leading-relaxed">
                    <span className="font-semibold">{n.who}</span>{' '}
                    <span className="text-th-muted">{n.action}</span>{' '}
                    <span className="font-semibold text-th-accent">{n.target}</span>
                  </p>
                  <p className="font-mono text-[10px] text-th-faint mt-0.5">{n.time}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background:'var(--th-accent)' }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}