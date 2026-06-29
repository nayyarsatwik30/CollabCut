'use client'
import { Sidebar } from '@/components/layout/Sidebar'
import { ThemePicker } from '@/components/layout/ThemePicker'
import { Clock } from 'lucide-react'
import Link from 'next/link'
import { MOCK_ASSETS } from '@/lib/mock-data'

export default function RecentPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center justify-between px-6">
          <h1 className="text-[15px] font-bold">Recent</h1>
          <ThemePicker />
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <p className="font-mono text-[10px] uppercase tracking-wider text-th-muted mb-4">Recently viewed</p>
          <div className="bg-th-surface rounded-th border border-th-border overflow-hidden max-w-2xl">
            {MOCK_ASSETS.map((a) => (
              <Link key={a.id} href={`/review/${a.id}`}
                className="flex items-center gap-4 px-5 py-3.5 border-b border-th-border last:border-b-0 hover:bg-th-surface-alt transition-colors">
                <span className="text-xl">{a.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate">{a.name}</p>
                  <p className="text-[11px] text-th-muted font-mono">{a.uploadedAt}</p>
                </div>
                <Clock size={13} className="text-th-faint" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}