import { createHmac, timingSafeEqual } from 'crypto'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { migrationDb } from '@/lib/migrationDb'
import { b2, B2_BUCKET } from '@/lib/b2'

// Reference files attached to review-screen comments ("use this clip
// instead"). They are stored as raw_files rows (so they count toward the
// same storage quota) and linked to a comment through comment_attachments
// (scripts/migrations/comment-raw-upload.sql). Logged-in members only.

export {
  ATTACHMENT_ACCEPT, MAX_ATTACHMENTS_PER_COMMENT, MAX_COMMENT_ATTACHMENT_BYTES, attachmentContentType, isInlineSafe,
} from '@/lib/comment-attachment-rules'

export const MAX_PENDING_PER_USER = 10
export const UPLOAD_TOKEN_TTL_MS = 60 * 60 * 1000
export const PENDING_MAX_AGE_HOURS = 24

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isMissingTable(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '42P01'
}

export const MIGRATION_MESSAGE = "Attachments aren't available right now."

export interface CommentAttachment {
  id: string
  file_name: string
  file_size_bytes: number | null
  content_type: string | null
  comment_id?: string | null
}

// ─── Signed upload token (initiate -> complete) ──────────────────────────────

export interface AttachmentTokenPayload {
  userId: string
  assetId: string
  projectId: string
  key: string
  safeName: string
  contentType: string
  declaredSize: number
  expiresAt: number
}

function sign(body: string): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not configured')
  return createHmac('sha256', secret).update(`comment-attachment:${body}`).digest('base64url')
}

export function signAttachmentToken(payload: AttachmentTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifyAttachmentToken(token: unknown, userId: string, now = Date.now()): AttachmentTokenPayload | null {
  if (typeof token !== 'string' || token.length > 4096) return null
  const [body, signature, ...rest] = token.split('.')
  if (!body || !signature || rest.length > 0) return null
  const expected = Buffer.from(sign(body))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try {
    const payload: AttachmentTokenPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (payload.userId !== userId || typeof payload.expiresAt !== 'number' || payload.expiresAt <= now) return null
    return payload
  } catch {
    return null
  }
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

// The asset exists and neither it nor its project is in the trash.
export async function assetIsLive(assetId: string): Promise<{ projectId: string } | null> {
  const result = await migrationDb.query(
    `SELECT a.project_id FROM assets a JOIN projects p ON p.id = a.project_id
     WHERE a.id = $1 AND a.deleted_at IS NULL AND p.deleted_at IS NULL`,
    [assetId],
  )
  return result.rows[0] ? { projectId: result.rows[0].project_id } : null
}

// Deletes B2 objects best-effort - call only after the matching raw_files
// rows are gone from the database. Failures are logged, not fatal (same as
// /api/raw-upload/[id]).
export async function deleteB2Objects(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map((key) =>
      b2.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: key })).catch((err) => {
        console.error('comment attachment B2 delete failed', (err as Error).name)
      }),
    ),
  )
}

// Removes still-unposted attachments only (rows + B2 objects). Conditional on
// comment_id IS NULL, so a file that got linked to a comment in the meantime
// is left alone. The B2 key comes from the row actually deleted.
export async function purgePendingRawFiles(files: { id: string }[]): Promise<void> {
  if (files.length === 0) return
  const deleted = await migrationDb.query(
    `DELETE FROM raw_files rf
     USING comment_attachments ca
     WHERE rf.id = ca.raw_file_id
       AND rf.id = ANY($1::uuid[])
       AND ca.comment_id IS NULL
     RETURNING rf.b2_key`,
    [files.map((f) => f.id)],
  )
  await deleteB2Objects(deleted.rows.map((row) => row.b2_key))
}

export function attachmentSelect(): string {
  return `SELECT ca.id, ca.comment_id, rf.file_name, rf.file_size_bytes, rf.content_type
          FROM comment_attachments ca JOIN raw_files rf ON rf.id = ca.raw_file_id`
}
