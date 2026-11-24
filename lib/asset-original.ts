import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { AbortMultipartUploadCommand, CreateMultipartUploadCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { b2, B2_BUCKET } from '@/lib/b2'
import { migrationDb } from '@/lib/migrationDb'
import { projectMembership } from '@/lib/api-auth'
import { video } from '@/lib/mux'
import { PART_SIZE, TOKEN_TTL_MS } from '@/lib/raw-upload-token'

// A video's exact uploaded file is stored in B2 so Download can return it.
// The browser uploads it there in multipart chunks (once), then the server
// hands Mux a presigned download URL so Mux ingests it server-to-server.
// Between init and complete the server keeps no state beyond the asset row:
// everything it needs to trust is inside a signed token bound to the asset
// and the uploader.

export const ORIGINAL_PART_SIZE = PART_SIZE
// B2/S3 allow at most 10,000 parts per multipart upload.
export const MAX_ORIGINAL_PARTS = 10_000
export const MAX_PART_URLS_PER_REQUEST = 5

// The row's mux_upload_id doubles as the "this asset has a file / is mid-upload"
// marker across the app (placeholder detection, polling, the cancel token).
// Originals have no Mux direct upload, so it holds the B2 multipart upload id
// behind this prefix, which also tells the cancel route which backend to abort.
const B2_UPLOAD_ID_PREFIX = 'b2:'
export const toRowUploadId = (b2UploadId: string) => `${B2_UPLOAD_ID_PREFIX}${b2UploadId}`
export const fromRowUploadId = (rowUploadId: string) => rowUploadId.slice(B2_UPLOAD_ID_PREFIX.length)
export const isB2RowUploadId = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(B2_UPLOAD_ID_PREFIX)

export function originalKey(projectId: string, assetId: string, fileName: string): string {
  return `originals/${projectId}/${assetId}/${fileName}`
}

// A client-supplied file name as it appears in an object key and in the
// download name: no path separators or control characters, capped in length
// with the extension kept (a plain slice would cut it off a long name).
export function sanitizeOriginalFileName(name: unknown): string {
  const cleaned = String(name ?? '')
    .replace(/[\u0000-\u001f\u007f"]/g, '')
    .replace(/[\\/]/g, '_')
    .trim()
  const extension = cleaned.match(/\.[A-Za-z0-9]{1,10}$/)?.[0] ?? ''
  const base = cleaned.slice(0, cleaned.length - extension.length).slice(0, 120 - extension.length)
  return `${base}${extension}`.trim() || 'video'
}

// File extension of a stored original name, without the dot ('' if none).
export function originalExtension(fileName: string | null | undefined): string {
  return fileName?.match(/\.([A-Za-z0-9]{1,10})$/)?.[1].toLowerCase() ?? ''
}

export function normalizeVideoContentType(value: unknown): string {
  return typeof value === 'string' && /^video\/[A-Za-z0-9.+-]{1,60}$/.test(value) ? value : 'application/octet-stream'
}

export interface OriginalTokenPayload {
  userId: string
  assetId: string
  key: string
  uploadId: string
  fileName: string
  contentType: string
  declaredSize: number
  totalParts: number
  expiresAt: number
}

function sign(body: string): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not configured')
  // Domain-separated so a raw-footage upload token (same secret) can never be
  // accepted here, or the other way round.
  return createHmac('sha256', secret).update(`asset-original:${body}`).digest('base64url')
}

export function signOriginalToken(payload: Omit<OriginalTokenPayload, 'expiresAt'>): string {
  const body = Buffer.from(JSON.stringify({ ...payload, expiresAt: Date.now() + TOKEN_TTL_MS })).toString('base64url')
  return `${body}.${sign(body)}`
}

function verifyOriginalToken(token: unknown, userId: string): OriginalTokenPayload | null {
  if (typeof token !== 'string' || token.length > 4096) return null
  const [body, signature, ...rest] = token.split('.')
  if (!body || !signature || rest.length > 0) return null

  const expected = Buffer.from(sign(body))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  let payload: OriginalTokenPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (payload.userId !== userId) return null
  if (typeof payload.expiresAt !== 'number' || payload.expiresAt <= Date.now()) return null
  return payload
}

// Shared gate for the part and complete routes: a genuine token issued to this
// caller, for an asset that still exists, is still waiting on exactly this B2
// upload, and whose project the caller still belongs to. Runs before any B2 or
// Mux call.
export async function authorizeOriginalUpload(
  token: unknown,
  userId: string,
): Promise<{ payload: OriginalTokenPayload } | { error: NextResponse }> {
  const payload = verifyOriginalToken(token, userId)
  if (!payload) {
    return { error: NextResponse.json({ error: 'Upload session is invalid or has expired. Please start the upload again.' }, { status: 401 }) }
  }

  const result = await migrationDb.query(
    `SELECT project_id, mux_upload_id FROM assets WHERE id = $1 AND deleted_at IS NULL`,
    [payload.assetId]
  )
  const asset = result.rows[0]
  if (!asset || asset.mux_upload_id !== toRowUploadId(payload.uploadId)) {
    return { error: NextResponse.json({ error: 'This upload is no longer active.' }, { status: 409 }) }
  }

  const membership = await projectMembership(asset.project_id, userId)
  if (membership === 'missing') return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) }
  if (membership === 'not_member') return { error: NextResponse.json({ error: 'Not authorized to upload to this project' }, { status: 403 }) }

  return { payload }
}

export interface StartedOriginalUpload {
  key: string
  b2UploadId: string
  rowUploadId: string
  fileName: string
  contentType: string
  uploadToken: string
  partSize: number
  totalParts: number
}

// Starts the B2 multipart upload for an asset's original and signs the token
// the browser uses for the part/complete routes. Throws if B2 is unreachable.
export async function startOriginalUpload(args: {
  userId: string
  projectId: string
  assetId: string
  name: unknown
  contentType: unknown
  sizeBytes: number
}): Promise<StartedOriginalUpload> {
  const fileName = sanitizeOriginalFileName(args.name)
  const contentType = normalizeVideoContentType(args.contentType)
  const key = originalKey(args.projectId, args.assetId, fileName)
  const created = await b2.send(new CreateMultipartUploadCommand({ Bucket: B2_BUCKET, Key: key, ContentType: contentType }))
  if (!created.UploadId) throw new Error('No upload id returned')

  const totalParts = Math.ceil(args.sizeBytes / ORIGINAL_PART_SIZE)
  const uploadToken = signOriginalToken({
    userId: args.userId,
    assetId: args.assetId,
    key,
    uploadId: created.UploadId,
    fileName,
    contentType,
    declaredSize: args.sizeBytes,
    totalParts,
  })
  return {
    key,
    b2UploadId: created.UploadId,
    rowUploadId: toRowUploadId(created.UploadId),
    fileName,
    contentType,
    uploadToken,
    partSize: ORIGINAL_PART_SIZE,
    totalParts,
  }
}

// Best effort: an upload that is already completed or aborted has nothing left to remove.
export async function abortOriginalUpload(key: string, b2UploadId: string): Promise<void> {
  await b2.send(new AbortMultipartUploadCommand({ Bucket: B2_BUCKET, Key: key, UploadId: b2UploadId })).catch((err) => {
    console.error('asset original abort failed', (err as Error).name)
  })
}

const MUX_INGEST_URL_TTL_SECONDS = 2 * 60 * 60
const MUX_CREATE_ATTEMPTS = 3

// Creates the Mux asset for an uploaded original by giving Mux a presigned B2
// URL to pull from. Settings are identical to the old direct-upload path;
// passthrough carries our asset id so the webhook can match the row even if it
// arrives before mux_asset_id is stored. Retried a couple of times; throws if
// every attempt fails.
export async function createMuxAssetFromOriginal(assetId: string, key: string): Promise<string> {
  const url = await getSignedUrl(b2, new GetObjectCommand({ Bucket: B2_BUCKET, Key: key }), {
    expiresIn: MUX_INGEST_URL_TTL_SECONDS,
  })
  let lastError: unknown
  for (let attempt = 1; attempt <= MUX_CREATE_ATTEMPTS; attempt++) {
    try {
      const asset = await video.assets.create({
        inputs: [{ url }],
        playback_policy: ['public'],
        mp4_support: 'capped-1080p',
        video_quality: 'plus',
        passthrough: assetId,
      })
      return asset.id
    } catch (err) {
      lastError = err
      if (attempt < MUX_CREATE_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }
  }
  throw lastError
}
