'use client'

import Link from 'next/link'
import { MessageSquare, Clock } from 'lucide-react'
import { Asset } from '@/lib/types'
import { StatusBadge } from '@/components/ui/Badge'

interface AssetCardProps {
  asset: Asset
  projectId: string
}

export function AssetCard({ asset, projectId }: AssetCardProps) {
  return (
    <Link
      href={`/review/${asset.id}`}
      className="block bg-th-surface border border-th-border rounded-th-lg overflow-hidden hover:border-th-accent transition-colors group shadow-card hover:shadow-card-hover"
    >
      {/* Thumbnail */}
      <div className="h-28 bg-th-surface-alt flex flex-col items-center justify-center gap-2 relative">
        <span className="text-3xl">{asset.emoji}</span>
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-th-muted">
          <Clock size={10} />
          {asset.duration}
        </div>
        {/* Version badge */}
        <div className="absolute top-2.5 left-2.5 font-mono text-[10px] px-1.5 py-px rounded bg-th-bg/70 text-th-muted border border-th-border">
          v{asset.version}
        </div>
        <div className="absolute top-2.5 right-2.5">
          <StatusBadge status={asset.status} />
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5">
        <p className="text-[13px] font-semibold truncate mb-3 group-hover:text-th-accent transition-colors">{asset.name}</p>
        <div className="flex items-center justify-between text-[11px] text-th-faint font-mono">
          <span>{asset.sizeLabel}</span>
          <span className="flex items-center gap-1.5"><MessageSquare size={10} />{asset.commentCount}</span>
        </div>
      </div>
    </Link>
  )
}
