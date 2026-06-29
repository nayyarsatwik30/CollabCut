import { cn } from '@/lib/utils'
import type { CommentStatus, ProjectStatus, AssetStatus } from '@/lib/types'

const STATUS_LABELS: Record<string, string> = {
  open:       'Open',
  resolved:   'Resolved',
  changes:    'Needs changes',
  in_review:  'In Review',
  approved:   'Approved',
  draft:      'Draft',
  processing: 'Processing…',
}

const STATUS_COLOR: Record<string, string> = {
  open:       'var(--th-open)',
  resolved:   'var(--th-resolved)',
  changes:    'var(--th-changes)',
  approved:   'var(--th-resolved)',
  in_review:  'var(--th-open)',
  draft:      'var(--th-muted)',
  processing: 'var(--th-info)',
}

interface StatusBadgeProps {
  status: CommentStatus | ProjectStatus | AssetStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const color = STATUS_COLOR[status] ?? 'var(--th-muted)'
  const label = STATUS_LABELS[status] ?? status

  return (
    <span
      className={cn('inline-flex items-center gap-1 text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-th-full font-mono', className)}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span className="text-[8px]">●</span>
      {label.toUpperCase()}
    </span>
  )
}

interface AvatarProps {
  initials: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  style?: React.CSSProperties
}

export function Avatar({ initials, color, size = 'md', className, style }: AvatarProps) {
  const sizeMap = {
    sm: 'w-6 h-6 text-[9px]',
    md: 'w-7 h-7 text-[11px]',
    lg: 'w-9 h-9 text-[13px]',
  }
  return (
    <div
      className={cn('rounded-full flex items-center justify-center font-extrabold shrink-0', sizeMap[size], className)}
      style={{ background: color, color: '#000', ...style }}
    >
      {initials}
    </div>
  )
}
