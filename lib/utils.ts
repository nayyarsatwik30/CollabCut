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

/** Strip characters that are unsafe in filenames on common filesystems */
function sanitizeFilenamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|\x00-\x1F]+/g, '').trim()
}

/** Build a safe ".mp4" filename from an asset's name and optional version number */
export function buildDownloadFilename(name: string, version?: number): string {
  const base = sanitizeFilenamePart(name.replace(/\.[^./\\]+$/, '')) || 'video'
  return `${base}${version ? ` v${version}` : ''}.mp4`
}

/** Mux static-rendition MP4 URL for a playback ID (capped-1080p, enabled on every asset via
 *  mp4_support). The `download` query param makes Mux respond with Content-Disposition:
 *  attachment for this filename - that header, not the HTML `download` attribute (which browsers
 *  ignore cross-origin), is what makes a plain <a href> actually save the file. */
export function muxDownloadUrl(playbackId: string, filename: string): string {
  return `https://stream.mux.com/${playbackId}/capped-1080p.mp4?download=${encodeURIComponent(filename)}`
}
