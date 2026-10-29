import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { requireAuth, canAccessAsset } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'
import { b2, B2_BUCKET } from '@/lib/b2'
import {
  MAX_COMMENT_ATTACHMENT_BYTES, MIGRATION_MESSAGE, assetIsLive, attachmentSelect, isMissingTable, verifyAttachmentToken,
} from '@/lib/comment-attachments'

// Step 2: the browser has PUT the file to B2. Re-check access, confirm the
// object really is there at the declared size, then record it as a raw_files
// row (counts toward storage) plus a pending comment_attachments link.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  const payload = verifyAttachmentToken(body?.uploadToken, user.id)
  if (!payload) {
    return NextResponse.json({ error: 'Upload session is invalid or has expired. Please try again.' }, { status: 401 })
  }

  if (!(await canAccessAsset(user.id, payload.assetId)) || !(await assetIsLive(payload.assetId))) {
    return NextResponse.json({ error: 'Not authorized to comment on this asset' }, { status: 403 })
  }

  const dropObject = () => b2.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: payload.key })).catch(() => {})

  try {
    // Double submit: already recorded.
    const existing = await migrationDb.query(
      `${attachmentSelect()} WHERE rf.b2_key = $1 AND ca.uploaded_by = $2`,
      [payload.key, user.id],
    )
    if (existing.rows[0]) return NextResponse.json({ attachment: existing.rows[0] })

    let size = 0
    try {
      const head = await b2.send(new HeadObjectCommand({ Bucket: B2_BUCKET, Key: payload.key }))
      size = head.ContentLength ?? 0
    } catch {
      return NextResponse.json({ error: 'The file did not finish uploading. Please try again.' }, { status: 400 })
    }
    if (size <= 0 || size > MAX_COMMENT_ATTACHMENT_BYTES || size !== payload.declaredSize) {
      await dropObject()
      return NextResponse.json({ error: 'The uploaded file did not match its declared size.' }, { status: 400 })
    }

    const client = await migrationDb.connect()
    try {
      await client.query('BEGIN')
      // Serialize concurrent completes of the same upload (raw_files.b2_key is
      // not unique): the loser waits, then sees the winner's row and replays it.
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [payload.key])
      const replay = await client.query(
        `${attachmentSelect()} WHERE rf.b2_key = $1 AND ca.uploaded_by = $2`,
        [payload.key, user.id],
      )
      if (replay.rows[0]) {
        await client.query('COMMIT')
        return NextResponse.json({ attachment: replay.rows[0] })
      }
      const raw = await client.query(
        `INSERT INTO raw_files (project_id, uploaded_by, file_name, b2_key, file_size_bytes, content_type)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [payload.projectId, user.id, payload.safeName, payload.key, size, payload.contentType],
      )
      const link = await client.query(
        `INSERT INTO comment_attachments (raw_file_id, asset_id, uploaded_by) VALUES ($1, $2, $3) RETURNING id`,
        [raw.rows[0].id, payload.assetId, user.id],
      )
      await client.query('COMMIT')
      return NextResponse.json({
        attachment: {
          id: link.rows[0].id,
          comment_id: null,
          file_name: payload.safeName,
          file_size_bytes: size,
          content_type: payload.contentType,
        },
      }, { status: 201 })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    if (isMissingTable(err)) {
      await dropObject()
      return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 })
    }
    console.error('comment attachment complete failed', (err as Error).name)
    return NextResponse.json({ error: 'Could not finish the upload. Please try again.' }, { status: 502 })
  }
}
