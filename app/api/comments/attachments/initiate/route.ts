import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuth, canAccessAsset } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'
import { b2, B2_BUCKET } from '@/lib/b2'
import { sanitizeFileName } from '@/lib/raw-upload-token'
import {
  MAX_COMMENT_ATTACHMENT_BYTES, MAX_PENDING_PER_USER, MIGRATION_MESSAGE, PENDING_MAX_AGE_HOURS, UPLOAD_TOKEN_TTL_MS,
  assetIsLive, attachmentContentType, isMissingTable, purgePendingRawFiles, signAttachmentToken,
} from '@/lib/comment-attachments'

// Step 1 of attaching a reference file to a comment: validate, then hand the
// browser a presigned single-PUT URL straight to B2. Members only - the
// caller must be able to comment on the asset (admin or assigned editor).
// Everything the complete step trusts is inside the signed token.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  const assetId = body?.assetId
  const fileSize = body?.fileSize
  if (typeof assetId !== 'string' || !assetId || typeof fileSize !== 'number' || !Number.isInteger(fileSize)) {
    return NextResponse.json({ error: 'assetId, fileName and fileSize required' }, { status: 400 })
  }
  if (fileSize <= 0) return NextResponse.json({ error: 'File is empty' }, { status: 400 })
  if (fileSize > MAX_COMMENT_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: `File exceeds the ${MAX_COMMENT_ATTACHMENT_BYTES / 1024 / 1024}MB attachment limit` }, { status: 400 })
  }

  // sanitizeFileName caps at 120 chars and would cut the extension off a long
  // name (then the type check rejects it) - shorten the base name instead.
  const rawName = typeof body?.fileName === 'string' ? body.fileName : ''
  const dot = rawName.lastIndexOf('.')
  const ext = dot > 0 && rawName.length - dot <= 10 ? rawName.slice(dot) : ''
  const safeName = sanitizeFileName(rawName.length > 110 ? rawName.slice(0, dot > 0 ? Math.max(1, 110 - ext.length) : 110) + ext : rawName)
  const contentType = attachmentContentType(safeName)
  if (!contentType) {
    return NextResponse.json({ error: 'This file type is not allowed. Use an image, video, audio, PDF or text file.' }, { status: 400 })
  }

  if (!(await canAccessAsset(user.id, assetId))) {
    return NextResponse.json({ error: 'Not authorized to comment on this asset' }, { status: 403 })
  }
  const live = await assetIsLive(assetId)
  if (!live) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  try {
    // Housekeeping: drop this user's own abandoned pending uploads (a file
    // attached but its comment never posted) so they stop costing quota.
    const stale = await migrationDb.query(
      `SELECT rf.id, rf.b2_key FROM comment_attachments ca JOIN raw_files rf ON rf.id = ca.raw_file_id
       WHERE ca.uploaded_by = $1 AND ca.comment_id IS NULL
         AND ca.created_at < now() - make_interval(hours => $2::int)`,
      [user.id, PENDING_MAX_AGE_HOURS],
    )
    await purgePendingRawFiles(stale.rows)

    const pending = await migrationDb.query(
      `SELECT count(*)::int AS n FROM comment_attachments WHERE uploaded_by = $1 AND comment_id IS NULL`,
      [user.id],
    )
    if (pending.rows[0].n >= MAX_PENDING_PER_USER) {
      return NextResponse.json({ error: 'Too many unsent attachments. Post or remove some first.' }, { status: 429 })
    }
  } catch (err) {
    if (isMissingTable(err)) return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 })
    throw err
  }

  const key = `${live.projectId}/comment-${randomUUID()}-${safeName}`
  try {
    const url = await getSignedUrl(
      b2,
      new PutObjectCommand({ Bucket: B2_BUCKET, Key: key, ContentLength: fileSize }),
      { expiresIn: UPLOAD_TOKEN_TTL_MS / 1000, signableHeaders: new Set(['content-length']) },
    )
    const uploadToken = signAttachmentToken({
      userId: user.id,
      assetId,
      projectId: live.projectId,
      key,
      safeName,
      contentType,
      declaredSize: fileSize,
      expiresAt: Date.now() + UPLOAD_TOKEN_TTL_MS,
    })
    return NextResponse.json({ uploadToken, url })
  } catch (err) {
    console.error('comment attachment initiate failed', (err as Error).name)
    return NextResponse.json({ error: 'Could not start the upload. Please try again.' }, { status: 502 })
  }
}
