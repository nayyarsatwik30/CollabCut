import { NextRequest, NextResponse } from 'next/server'
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  type Part,
} from '@aws-sdk/client-s3'
import type { PoolClient } from 'pg'
import { requireAuth } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'
import { b2, B2_BUCKET } from '@/lib/b2'
import { MIN_PART_SIZE } from '@/lib/raw-upload-token'
import { authorizeOriginalUpload, createMuxAssetFromOriginal, type OriginalTokenPayload } from '@/lib/asset-original'

const UNFINISHED = "The upload didn't finish properly. Please try again."

async function listAllParts(key: string, uploadId: string): Promise<Part[]> {
  const parts: Part[] = []
  let marker: string | undefined
  do {
    const page = await b2.send(new ListPartsCommand({ Bucket: B2_BUCKET, Key: key, UploadId: uploadId, PartNumberMarker: marker }))
    parts.push(...(page.Parts ?? []))
    marker = page.IsTruncated ? page.NextPartNumberMarker : undefined
  } while (marker)
  return parts.sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0))
}

// Finishes the original's B2 upload, then has Mux ingest it. Safe to call any
// number of times: every step is skipped once its result is recorded, and a
// Mux asset is never created twice for one row.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => null)
  const gate = await authorizeOriginalUpload(body?.uploadToken, auth.user.id)
  if ('error' in gate) return gate.error
  const { payload } = gate

  // Serialized per asset with a session-level advisory lock (needs a direct,
  // non-pooled connection; every query under the lock uses this one client).
  // A concurrent call never touches B2 or Mux - it answers 409 and the client
  // retries.
  const lockName = `asset-original:${payload.assetId}`
  const lockClient = await migrationDb.connect()
  let locked = false
  let unlockFailed = false
  try {
    const lockResult = await lockClient.query(`SELECT pg_try_advisory_lock(hashtext($1)) AS ok`, [lockName])
    locked = lockResult.rows[0]?.ok === true
    if (!locked) {
      return NextResponse.json({ error: 'This upload is already being finalized - try again in a moment.' }, { status: 409 })
    }
    return await finalize(lockClient, payload)
  } finally {
    if (locked) {
      try {
        await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [lockName])
      } catch {
        unlockFailed = true
      }
    }
    // A connection whose unlock failed is destroyed so the lock can't leak.
    lockClient.release(unlockFailed ? true : undefined)
  }
}

async function finalize(db: PoolClient, payload: OriginalTokenPayload): Promise<NextResponse> {
  try {
    const rowResult = await db.query(
      `SELECT original_b2_key, mux_asset_id FROM assets WHERE id = $1 AND deleted_at IS NULL`,
      [payload.assetId]
    )
    const row = rowResult.rows[0]
    if (!row) return NextResponse.json({ error: 'This upload is no longer active.' }, { status: 409 })

    // Double submit: nothing left to do.
    if (row.mux_asset_id) return NextResponse.json({ success: true })

    if (!row.original_b2_key) {
      const failure = await storeOriginal(db, payload)
      if (failure) return failure
    }

    // Mux ingests the original server-to-server. The B2 object stays put if
    // this fails; the client simply calls complete again.
    let muxAssetId: string
    try {
      muxAssetId = await createMuxAssetFromOriginal(payload.assetId, payload.key)
    } catch (err) {
      console.error('asset original mux ingest failed', (err as Error).name)
      return NextResponse.json({ error: 'Your file is saved, but processing could not start. Please try again in a moment.' }, { status: 502 })
    }
    await db.query(
      `UPDATE assets SET mux_asset_id = $1 WHERE id = $2 AND mux_asset_id IS NULL`,
      [muxAssetId, payload.assetId]
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('asset original complete failed', (err as Error).name)
    return NextResponse.json({ error: 'Could not finish the upload. Please try again.' }, { status: 502 })
  }
}

// Completes the multipart upload, verifies the stored object is exactly the
// size the client declared, and records its key. Returns an error response, or
// null once the original is safely recorded.
async function storeOriginal(db: PoolClient, payload: OriginalTokenPayload): Promise<NextResponse | null> {
  let parts: Part[] | null = null
  try {
    parts = await listAllParts(payload.key, payload.uploadId)
  } catch (err) {
    if ((err as { name?: string }).name !== 'NoSuchUpload') throw err
    // The multipart upload is gone: an earlier call already completed it (the
    // reply or the DB write was lost) or it was aborted. The size check on
    // the object below tells which.
  }

  if (parts) {
    const contiguous = parts.length === payload.totalParts && parts.every((p, i) => p.PartNumber === i + 1 && !!p.ETag)
    if (!contiguous) return NextResponse.json({ error: UNFINISHED }, { status: 400 })

    const total = parts.reduce((sum, p) => sum + (p.Size ?? 0), 0)
    const smallPart = parts.slice(0, -1).some((p) => (p.Size ?? 0) < MIN_PART_SIZE)
    if (smallPart || total !== payload.declaredSize) {
      await b2.send(new AbortMultipartUploadCommand({ Bucket: B2_BUCKET, Key: payload.key, UploadId: payload.uploadId })).catch(() => {})
      return NextResponse.json({ error: UNFINISHED }, { status: 400 })
    }

    await b2.send(
      new CompleteMultipartUploadCommand({
        Bucket: B2_BUCKET,
        Key: payload.key,
        UploadId: payload.uploadId,
        MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag })) },
      }),
    )
  }

  let head
  try {
    head = await b2.send(new HeadObjectCommand({ Bucket: B2_BUCKET, Key: payload.key }))
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    if ((err as { name?: string }).name === 'NotFound' || status === 404) {
      return NextResponse.json({ error: UNFINISHED }, { status: 400 })
    }
    throw err
  }
  if (head.ContentLength !== payload.declaredSize) {
    await b2.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: payload.key, VersionId: head.VersionId })).catch(() => {})
    return NextResponse.json({ error: UNFINISHED }, { status: 400 })
  }

  // original_b2_key is only ever set from NULL: an existing original can
  // never be overwritten, and a row that was cancelled meanwhile gets nothing.
  const updated = await db.query(
    `UPDATE assets
     SET original_b2_key = $1, original_file_name = $2, original_content_type = $3
     WHERE id = $4 AND original_b2_key IS NULL AND deleted_at IS NULL
     RETURNING id`,
    [payload.key, payload.fileName, payload.contentType, payload.assetId]
  )
  if (!updated.rows[0]) {
    await b2.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: payload.key, VersionId: head.VersionId })).catch(() => {})
    return NextResponse.json({ error: 'This upload is no longer active.' }, { status: 409 })
  }
  return null
}
