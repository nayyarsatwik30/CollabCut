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

// Status chips use the palette only (classes in globals.css): resolved and
// approved are a lime fill, open and in-review an outline, needs-changes the
// danger colour, everything else a muted outline.
const STATUS_CHIP: Record<string, string> = {
  open:       'chip-open',
  resolved:   'chip-resolved',
  changes:    'chip-changes',
  approved:   'chip-resolved',
  in_review:  'chip-open',
  draft:      'chip-muted',
  processing: 'chip-muted',
}

interface StatusBadgeProps {
  status: CommentStatus | ProjectStatus | AssetStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const chip = STATUS_CHIP[status] ?? 'chip-muted'
  const label = STATUS_LABELS[status] ?? status

  return (
    <span className={cn('app-pill text-[10px] font-mono', chip, className)}>
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

// `color` stays in the props so existing call sites keep compiling: per-person
// colours are not part of the palette, so every avatar is the same neutral pair.
export function Avatar({ initials, size = 'md', className, style }: AvatarProps) {
  const sizeMap = {
    sm: 'w-6 h-6 text-[9px]',
    md: 'w-7 h-7 text-[11px]',
    lg: 'w-9 h-9 text-[13px]',
  }
  return (
    <div
      className={cn('app-avatar font-extrabold border border-th-border-strong', sizeMap[size], className)}
      style={style}
    >
      {initials}
    </div>
  )
}
