'use client'
import { Sidebar } from '@/components/layout/Sidebar'
import { Star } from 'lucide-react'
import Link from 'next/link'

export default function StarredPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center justify-between px-6">
          <h1 className="text-[15px] font-bold">Starred</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-14 h-14 rounded-th-lg bg-th-surface-alt border border-th-border flex items-center justify-center">
            <Star size={24} className="text-th-faint" />
          </div>
          <div>
            <p className="font-semibold mb-1">No starred projects yet</p>
            <p className="text-[13px] text-th-muted">Star a project from the dashboard to pin it here.</p>
          </div>
          <Link href="/dashboard" className="text-[13px] text-th-accent hover:underline">
            Go to projects
          </Link>
        </div>
      </div>
    </div>
  )
}
