import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { hasWorkspaceRole } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'

// Raw footage goes browser -> B2 in multipart chunks. Between initiate and
// complete the server keeps no state: everything it needs to trust is inside
// a signed token, so the client can't change the key, upload id, size or
// project it is uploading to.

export const PART_SIZE = 8 * 1024 * 1024
export const MIN_PART_SIZE = 5 * 1024 * 1024
export const TOKEN_TTL_MS = 12 * 60 * 60 * 1000
export const MAX_PART_URLS_PER_REQUEST = 5

export interface UploadTokenPayload {
  userId: string
  projectId: string
  key: string
  uploadId: string
  safeName: string
  contentType: string
  declaredSize: number
  totalParts: number
  expiresAt: number
}

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET
  if (!value) throw new Error('NEXTAUTH_SECRET is not configured')
  return value
}

function sign(body: string): string {
  return createHmac('sha256', secret()).update(body).digest('base64url')
}

export function signUploadToken(payload: UploadTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

// Returns the payload for a token that is genuine, unexpired and issued to
// `userId` - null for anything else (tampered, expired, someone else's).
export function verifyUploadToken(token: unknown, userId: string, now = Date.now()): UploadTokenPayload | null {
  if (typeof token !== 'string' || token.length > 4096) return null
  const [body, signature, ...rest] = token.split('.')
  if (!body || !signature || rest.length > 0) return null

  const expected = Buffer.from(sign(body))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  let payload: UploadTokenPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (payload.userId !== userId) return null
  if (typeof payload.expiresAt !== 'number' || payload.expiresAt <= now) return null
  return payload
}

// What a client-supplied name becomes inside an object key: no path
// separators or control characters, capped in length. The key keeps the
// `${projectId}/${uuid}-${name}` shape list/delete already rely on.
export function sanitizeFileName(name: unknown): string {
  const cleaned = String(name ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '_')
    .trim()
    .slice(0, 120)
  return cleaned || 'file'
}

export function safeContentType(type: unknown): string {
  return typeof type === 'string' && /^(video|audio|image)\/[\w.+-]+$/i.test(type) ? type : 'application/octet-stream'
}

// Shared gate for part/complete/abort: valid token for this caller, and the
// caller is still an admin of the project's workspace right now.
export async function authorizeUpload(
  token: unknown,
  userId: string,
): Promise<{ payload: UploadTokenPayload } | { error: NextResponse }> {
  const payload = verifyUploadToken(token, userId)
  if (!payload) {
    return { error: NextResponse.json({ error: 'Upload session is invalid or has expired. Please start the upload again.' }, { status: 401 }) }
  }

  const projectResult = await migrationDb.query(`SELECT workspace_id FROM projects WHERE id = $1`, [payload.projectId])
  const workspaceId = projectResult.rows[0]?.workspace_id
  if (!workspaceId) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) }

  const isAdmin = await hasWorkspaceRole(workspaceId, userId, 'admin')
  if (!isAdmin) return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }

  return { payload }
}
