'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Share2, Upload, Plus, UserPlus } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { ThemePicker } from '@/components/layout/ThemePicker'
import { AssetCard } from '@/components/project/AssetCard'
import { StatusBadge, Avatar } from '@/components/ui/Badge'
import { MOCK_ASSETS, MOCK_MEMBERS, MOCK_ACTIVITY, MOCK_PROJECTS } from '@/lib/mock-data'

type Tab = 'assets' | 'members' | 'activity'

export default function ProjectPage({ params }: { params: { id: string } }) {
  const [tab, setTab] = useState<Tab>('assets')
  const project = MOCK_PROJECTS.find((p) => p.id === params.id) ?? MOCK_PROJECTS[0]

  return (
    <div className="flex h-screen overflow-hidden bg-th-bg">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="h-13 shrink-0 bg-th-surface border-b border-th-border flex items-center gap-2 px-5">
          {/* Breadcrumb */}
          <Link href="/dashboard" className="text-[13px] text-th-muted hover:text-th-text transition-colors">
            Projects
          </Link>
          <ChevronRight size={13} className="text-th-faint" />
          <span className="text-[13px] font-semibold truncate">{project.name}</span>
          <StatusBadge status={project.status} className="ml-2" />

          <div className="ml-auto flex items-center gap-2.5">
            <ThemePicker />
            <button className="flex items-center gap-1.5 h-8 px-3.5 rounded-th bg-th-surface-alt border border-th-border text-[13px] text-th-text btn-press hover:bg-th-surface-hov transition-colors">
              <Share2 size={13} /> Share
            </button>
            <button className="flex items-center gap-1.5 h-8 px-3.5 rounded-th bg-th-accent text-th-accent-fg text-[13px] font-semibold btn-press hover:opacity-90 transition-opacity">
              <Upload size={13} /> Upload
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 bg-th-surface border-b border-th-border px-5 flex gap-0">
          {(['assets', 'members', 'activity'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-3 text-[13px] capitalize transition-colors border-b-2 btn-press"
              style={{
                color: tab === t ? 'var(--th-accent)' : 'var(--th-muted)',
                borderColor: tab === t ? 'var(--th-accent)' : 'transparent',
                fontWeight: tab === t ? 700 : 400,
              }}
            >
              {t}
              {t === 'assets' && (
                <span className="ml-1.5 font-mono text-[10px] text-th-faint">{MOCK_ASSETS.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Assets tab ── */}
          {tab === 'assets' && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {MOCK_ASSETS.map((a) => (
                <AssetCard key={a.id} asset={a} projectId={params.id} />
              ))}
              {/* Upload card */}
              <button className="flex flex-col items-center justify-center gap-3 h-[172px] rounded-th-lg border-2 border-dashed border-th-border text-th-muted hover:border-th-accent hover:text-th-accent transition-colors btn-press">
                <Upload size={20} />
                <span className="text-[12px] font-medium">Upload cut</span>
              </button>
            </div>
          )}

          {/* ── Members tab ── */}
          {tab === 'members' && (
            <div className="max-w-lg">
              <div className="bg-th-surface rounded-th-lg border border-th-border overflow-hidden mb-4">
                {MOCK_MEMBERS.map((m, i) => (
                  <div
                    key={m.email}
                    className="flex items-center gap-3.5 px-5 py-3.5 border-b border-th-border last:border-b-0"
                  >
                    <Avatar initials={m.initials} color={m.avatarColor} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold">{m.name}</p>
                      <p className="text-[11px] text-th-muted">{m.email}</p>
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-th-full bg-th-surface-alt border border-th-border text-th-muted">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
              <button className="flex items-center gap-2 h-9 px-4 rounded-th bg-th-surface-alt border border-th-border text-[13px] text-th-text btn-press hover:bg-th-surface-hov transition-colors">
                <UserPlus size={14} className="text-th-muted" /> Invite reviewer
              </button>
            </div>
          )}

          {/* ── Activity tab ── */}
          {tab === 'activity' && (
            <div className="max-w-lg space-y-0">
              {MOCK_ACTIVITY.map((item, i) => (
                <div
                  key={item.id}
                  className="flex gap-3.5 pb-5 mb-5 border-b border-th-border last:border-b-0 last:mb-0"
                >
                  <Avatar initials={item.initials} color={item.avatarColor} size="sm" />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-[13px]">
                      <span className="font-semibold">{item.who}</span>{' '}
                      <span className="text-th-muted">{item.action}</span>
                      {item.detail && (
                        <span className="font-mono text-[11px] text-th-accent ml-1.5">{item.detail}</span>
                      )}
                    </p>
                    <p className="font-mono text-[10px] text-th-faint mt-0.5">{item.createdAt}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
