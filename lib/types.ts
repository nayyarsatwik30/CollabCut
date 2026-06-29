// ─── Theme ───────────────────────────────────────────────────────────────────

export type ThemeKey = 'film' | 'arctic' | 'noir' | 'sunset' | 'slate'

export interface Theme {
  name: string
  desc: string
  swatch: string
  font: string
  mono: string
}

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  initials: string
  avatarColor: string
  role: 'owner' | 'editor' | 'client' | 'viewer'
}

// ─── Project ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'in_review' | 'approved' | 'changes' | 'draft'

export interface Project {
  id: string
  name: string
  client: string
  status: ProjectStatus
  assetCount: number
  commentCount: number
  memberCount: number
  updatedAt: string
  createdAt: string
  emoji: string
}

// ─── Asset ───────────────────────────────────────────────────────────────────

export type AssetStatus = 'in_review' | 'approved' | 'changes' | 'processing'

export interface Asset {
  id: string
  projectId: string
  name: string
  version: number
  duration: string      // formatted "mm:ss"
  durationSec: number   // raw seconds
  sizeLabel: string     // formatted "840 MB"
  status: AssetStatus
  commentCount: number
  muxPlaybackId?: string // populated once Mux finishes processing
  emoji: string
  uploadedAt: string
  uploadedBy: string
}

// ─── Asset version ───────────────────────────────────────────────────────────

export interface AssetVersion {
  id: string
  versionNumber: number
  label: string
  sizeLabel: string
  uploadedAt: string
  isCurrent: boolean
  muxPlaybackId?: string
}

// ─── Comments ────────────────────────────────────────────────────────────────

export type CommentStatus = 'open' | 'resolved' | 'changes'

export interface CommentReply {
  id: string
  author: string
  initials: string
  avatarColor: string
  text: string
  createdAt: string
}

export interface Comment {
  id: string
  assetId: string
  timeSec: number       // exact second the note was dropped
  author: string
  initials: string
  avatarColor: string
  status: CommentStatus
  text: string
  replies: CommentReply[]
  resolved: boolean
  createdAt: string
}

// ─── Share link ──────────────────────────────────────────────────────────────

export interface ShareLink {
  token: string
  url: string
  passwordProtected: boolean
  expiresAt?: string
  downloadsDisabled: boolean
  commentsOnly: boolean
}

// ─── Activity ────────────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string
  who: string
  initials: string
  avatarColor: string
  action: string
  detail?: string
  createdAt: string
}

// ─── Annotation ──────────────────────────────────────────────────────────────

export type AnnotationTool = 'line' | 'rect' | 'circle' | 'arrow' | null

export interface Annotation {
  id: string
  type: Exclude<AnnotationTool, null>
  startX: number
  startY: number
  endX: number
  endY: number
  color: string
}
