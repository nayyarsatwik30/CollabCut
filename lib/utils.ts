import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { CommentStatus, ProjectStatus, AssetStatus } from './types'

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format seconds as SMPTE timecode at 24fps */
export function formatTimecode(seconds: number, fps = 24): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0
  const totalFrames = Math.floor(seconds * fps)
  const h  = Math.floor(totalFrames / (3600 * fps))
  const m  = Math.floor((totalFrames % (3600 * fps)) / (60 * fps))
  const s  = Math.floor((totalFrames % (60 * fps)) / fps)
  const f  = totalFrames % fps
  const p  = (n: number) => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`
}

/** Format seconds as mm:ss */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Map status to label */
export const STATUS_LABELS: Record<CommentStatus | ProjectStatus | AssetStatus, string> = {
  open:       'Open',
  resolved:   'Resolved',
  changes:    'Needs changes',
  in_review:  'In Review',
  approved:   'Approved',
  draft:      'Draft',
  processing: 'Processing',
}

/** Map comment status to CSS variable name (for inline color) */
export function commentStatusVar(status: CommentStatus): string {
  const map: Record<CommentStatus, string> = {
    open:     'var(--th-open)',
    resolved: 'var(--th-resolved)',
    changes:  'var(--th-changes)',
  }
  return map[status] ?? 'var(--th-open)'
}

/** Map project/asset status to CSS variable */
export function projectStatusVar(status: ProjectStatus | AssetStatus): string {
  if (status === 'approved') return 'var(--th-resolved)'
  if (status === 'changes')  return 'var(--th-changes)'
  if (status === 'in_review') return 'var(--th-open)'
  return 'var(--th-muted)'
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Generate a random share token (frontend only – real one comes from backend) */
export function mockShareToken(): string {
  return Math.random().toString(36).slice(2, 10)
}
