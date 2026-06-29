'use client'

import Link from 'next/link'
import { MessageSquare, Users, Film } from 'lucide-react'
import { Project } from '@/lib/types'
import { StatusBadge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

interface ProjectCardProps {
  project: Project
  view: 'grid' | 'list'
}

export function ProjectCard({ project, view }: ProjectCardProps) {
  if (view === 'list') {
    return (
      <Link
        href={`/project/${project.id}`}
        className="flex items-center gap-4 px-5 py-3.5 border-b border-th-border last:border-b-0 hover:bg-th-surface-alt transition-colors group"
      >
        <div className="w-9 h-9 rounded-th-sm bg-th-surface-alt border border-th-border flex items-center justify-center text-xl shrink-0">
          {project.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold truncate group-hover:text-th-accent transition-colors">{project.name}</p>
          <p className="text-[11px] text-th-muted">{project.client}</p>
        </div>
        <StatusBadge status={project.status} />
        <div className="hidden sm:flex items-center gap-4 text-[11px] text-th-muted font-mono">
          <span className="flex items-center gap-1"><Film size={10} />{project.assetCount}</span>
          <span className="flex items-center gap-1"><MessageSquare size={10} />{project.commentCount}</span>
        </div>
        <span className="text-[11px] text-th-faint font-mono w-16 text-right shrink-0">{project.updatedAt}</span>
      </Link>
    )
  }

  return (
    <Link
      href={`/project/${project.id}`}
      className="block bg-th-surface border border-th-border rounded-th-lg overflow-hidden hover:border-th-accent transition-colors group shadow-card hover:shadow-card-hover"
    >
      {/* Thumbnail */}
      <div className="h-32 bg-th-surface-alt flex items-center justify-center relative">
        <span className="text-4xl">{project.emoji}</span>
        <div className="absolute top-2.5 right-2.5">
          <StatusBadge status={project.status} />
        </div>
        <div className="absolute inset-0 bg-th-accent/0 group-hover:bg-th-accent/5 transition-colors" />
      </div>

      {/* Meta */}
      <div className="p-4">
        <p className="text-[14px] font-bold truncate mb-1 group-hover:text-th-accent transition-colors">{project.name}</p>
        <p className="text-[12px] text-th-muted mb-4 truncate">{project.client}</p>
        <div className="flex items-center gap-4 text-[11px] text-th-faint font-mono">
          <span className="flex items-center gap-1.5"><Film size={10} />{project.assetCount} assets</span>
          <span className="flex items-center gap-1.5"><MessageSquare size={10} />{project.commentCount}</span>
          <span className="flex items-center gap-1.5 ml-auto">{project.updatedAt}</span>
        </div>
      </div>
    </Link>
  )
}
