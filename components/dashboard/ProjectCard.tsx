'use client'

import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  name: string
  client: string
  status: string
  emoji?: string
  updated_at?: string
}

interface ProjectCardProps {
  project: Project
  view: 'grid' | 'list'
  onDelete?: (id: string) => void
}

const STATUS_COLOR: Record<string, string> = {
  in_review: 'var(--th-open)',
  approved: 'var(--th-resolved)',
  changes: 'var(--th-changes)',
  draft: 'var(--th-muted)',
}

const STATUS_LABEL: Record<string, string> = {
  in_review: 'IN REVIEW',
  approved: 'APPROVED',
  changes: 'NEEDS CHANGES',
  draft: 'DRAFT',
}

export function ProjectCard({ project, view, onDelete }: ProjectCardProps) {
  const color = STATUS_COLOR[project.status] ?? 'var(--th-muted)'
  const label = STATUS_LABEL[project.status] ?? project.status.toUpperCase()

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm(`Delete "${project.name}"? You can restore it from the Recycle Bin.`)) {
      onDelete?.(project.id)
    }
  }

  if (view === 'list') {
    return (
      <div className="relative group">
        <Link
          href={`/project/${project.id}`}
          className="flex items-center gap-4 px-5 py-3.5 border-b border-th-border last:border-b-0 hover:bg-th-surface-alt transition-colors"
        >
          <span className="text-xl">{project.emoji ?? '🎬'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate">{project.name}</p>
            <p className="text-[11px] text-th-muted">{project.client}</p>
          </div>
          <span
            className="font-mono text-[10px] px-2 py-0.5 rounded-th-full"
            style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
          >
            {label}
          </span>
        </Link>
        {onDelete && (
          <button
            onClick={handleDelete}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-th-sm opacity-0 group-hover:opacity-100 transition-opacity text-th-muted hover:text-th-changes hover:bg-th-changes/10"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="relative group">
      <Link
        href={`/project/${project.id}`}
        className="block bg-th-surface border border-th-border rounded-th-lg overflow-hidden hover:border-th-accent transition-colors shadow-card hover:shadow-card-hover"
      >
        <div className="h-28 bg-th-surface-alt flex items-center justify-center relative">
          <span className="text-4xl">{project.emoji ?? '🎬'}</span>
          <span
            className="absolute top-2.5 right-2.5 font-mono text-[10px] px-2 py-0.5 rounded-th-full"
            style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
          >
            {label}
          </span>
        </div>
        <div className="p-3.5">
          <p className="text-[13px] font-semibold truncate mb-1">{project.name}</p>
          <p className="text-[11px] text-th-muted truncate">{project.client}</p>
        </div>
      </Link>

      {onDelete && (
        <button
          onClick={handleDelete}
          className="absolute top-2.5 left-2.5 p-1.5 rounded-th-sm bg-th-bg/70 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:text-th-changes"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}