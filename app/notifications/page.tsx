'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { Bell } from 'lucide-react'

export default function NotificationsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center justify-between px-6">
          <h1 className="text-[15px] font-bold">Notifications</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-3 text-center">
          <Bell size={28} className="text-th-faint" />
          <p className="font-semibold">No notifications yet</p>
          <p className="text-[13px] text-th-muted">You'll be notified when someone comments or approves a cut.</p>
        </div>
      </div>
    </div>
  )
}
