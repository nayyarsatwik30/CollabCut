import { NextRequest, NextResponse } from 'next/server'
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  type Part,
} from '@aws-sdk/client-s3'
import type { PoolClient } from 'pg'
import { requireAuth } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'
import { b2, B2_BUCKET } from '@/lib/b2'
import { MAX_RAW_FILE_BYTES, fileExtension, hasSignature, matchesSignature } from '@/lib/raw-files'
import { MIN_PART_SIZE, authorizeUpload, type UploadTokenPayload } from '@/lib/raw-upload-token'

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

const RAW_FILE_COLUMNS = 'id, project_id, uploaded_by, file_name, file_size_bytes, content_type, created_at'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  const gate = await authorizeUpload(body?.uploadToken, user.id)
  if ('error' in gate) return gate.error
  const { payload } = gate

  // NOTE: session-level advisory locks need a direct (non-transaction-pooled)
  // database connection. Every query made while the lock is held runs on this
  // one client, so a request holds exactly one pooled connection.
  // Completion is serialized per upload key with a session-level Postgres
  // advisory lock (no schema change): a concurrent request that can't get it
  // never touches B2 - it returns the recorded row if there is one, else 409.
  const lockClient = await migrationDb.connect()
  let locked = false
  let unlockFailed = false
  try {
    const lockResult = await lockClient.query(`SELECT pg_try_advisory_lock(hashtext($1)) AS ok`, [payload.key])
    locked = lockResult.rows[0]?.ok === true
    if (!locked) {
      const recorded = await lockClient.query(`SELECT ${RAW_FILE_COLUMNS} FROM raw_files WHERE b2_key = $1 LIMIT 1`, [payload.key])
      if (recorded.rows[0]) return NextResponse.json({ rawFile: recorded.rows[0] }, { status: 200 })
      return NextResponse.json({ error: 'This upload is already being finalized - try again in a moment.' }, { status: 409 })
    }
    return await finalizeUpload(lockClient, payload, user.id)
  } finally {
    if (locked) {
      try {
        await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [payload.key])
      } catch {
        unlockFailed = true
      }
    }
    // A connection whose unlock failed is destroyed so the lock can't leak.
    lockClient.release(unlockFailed ? true : undefined)
  }
}

async function finalizeUpload(db: PoolClient, payload: UploadTokenPayload, userId: string): Promise<NextResponse> {
  // Double submit: the upload already finished and was recorded.
  const existing = await db.query(`SELECT ${RAW_FILE_COLUMNS} FROM raw_files WHERE b2_key = $1 LIMIT 1`, [payload.key])
  if (existing.rows[0]) return NextResponse.json({ rawFile: existing.rows[0] }, { status: 200 })

  // Set once the object exists in B2; if anything after that throws, no row
  // was recorded, so the object is removed rather than orphaned.
  let completedObject: { versionId?: string } | null = null
  try {
    // The parts B2 actually holds are the only source of truth - nothing
    // about ETags or sizes is taken from the client.
    const parts = await listAllParts(payload.key, payload.uploadId)

    const contiguous =
      parts.length === payload.totalParts && parts.every((p, i) => p.PartNumber === i + 1 && !!p.ETag)
    if (!contiguous) {
      return NextResponse.json({ error: "The upload didn't finish properly. Please try again." }, { status: 400 })
    }

    const total = parts.reduce((sum, p) => sum + (p.Size ?? 0), 0)
    const smallPart = parts.slice(0, -1).some((p) => (p.Size ?? 0) < MIN_PART_SIZE)
    if (smallPart || total !== payload.declaredSize || total > MAX_RAW_FILE_BYTES) {
      await b2.send(new AbortMultipartUploadCommand({ Bucket: B2_BUCKET, Key: payload.key, UploadId: payload.uploadId })).catch(() => {})
      return NextResponse.json({ error: "The upload didn't finish properly. Please try again." }, { status: 400 })
    }

    const completed = await b2.send(
      new CompleteMultipartUploadCommand({
        Bucket: B2_BUCKET,
        Key: payload.key,
        UploadId: payload.uploadId,
        MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag })) },
      }),
    )

    completedObject = { versionId: completed.VersionId }

    const headObj = await b2.send(new HeadObjectCommand({ Bucket: B2_BUCKET, Key: payload.key }))
    const size = headObj.ContentLength ?? 0
    if (size <= 0 || size > MAX_RAW_FILE_BYTES || size !== payload.declaredSize) {
      await b2.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: payload.key, VersionId: completed.VersionId })).catch(() => {})
      return NextResponse.json({ error: "The upload didn't finish properly. Please try again." }, { status: 400 })
    }

    // Content sniff for formats with a fixed signature (photos, wav, flac,
    // ogg): the first bytes must agree with the extension. Fails closed - if
    // the probe can't be read for such a format, the object is removed and the
    // client retries. Formats without a signature (null) skip the probe.
    let signatureOk: boolean | null = null
    if (hasSignature(fileExtension(payload.safeName))) {
      try {
        const probe = await b2.send(new GetObjectCommand({ Bucket: B2_BUCKET, Key: payload.key, Range: 'bytes=0-15' }))
        signatureOk = matchesSignature(payload.safeName, (await probe.Body?.transformToByteArray()) ?? new Uint8Array())
      } catch (err) {
        console.error('raw-upload signature read failed', (err as Error).name)
        await b2.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: payload.key, VersionId: completed.VersionId })).catch(() => {})
        return NextResponse.json({ error: 'Could not verify the file. Please try the upload again.' }, { status: 502 })
      }
    }
    if (signatureOk === false) {
      await b2.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: payload.key, VersionId: completed.VersionId })).catch(() => {})
      return NextResponse.json({ error: "The file's contents don't match its file type. Check that it opens on your computer, or export it again." }, { status: 400 })
    }

    const insertResult = await db.query(
      `INSERT INTO raw_files (project_id, uploaded_by, file_name, b2_key, file_size_bytes, content_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, project_id, uploaded_by, file_name, file_size_bytes, content_type, created_at`,
      [payload.projectId, userId, payload.safeName, payload.key, size, payload.contentType],
    )
    return NextResponse.json({ rawFile: insertResult.rows[0] }, { status: 201 })
  } catch (err) {
    console.error('raw-upload complete failed', (err as Error).name)
    // The INSERT may have committed even though its reply was lost. Only a
    // positively confirmed "no row" allows deleting the object; if we can't
    // tell, keep it (an orphaned object beats a row pointing at nothing) and
    // let the client retry - the retry finds the row, or cleans the object.
    const lookup = async (run: (sql: string, args: unknown[]) => Promise<{ rows: any[] }>) =>
      (await run(`SELECT ${RAW_FILE_COLUMNS} FROM raw_files WHERE b2_key = $1 LIMIT 1`, [payload.key])).rows[0] ?? null
    let recordedRow: any = null
    let rowCheckFailed = false
    try {
      // Lock client only: a second pool connection here could deadlock the pool.
      recordedRow = await lookup((q, a) => db.query(q, a))
    } catch {
      rowCheckFailed = true
    }
    if (recordedRow) return NextResponse.json({ rawFile: recordedRow }, { status: 200 })
    if (rowCheckFailed) {
      return NextResponse.json({ error: 'Could not confirm the upload. Please try again in a moment.' }, { status: 502 })
    }

    // CompleteMultipartUpload may have succeeded with its response lost: look
    // for the (uniquely keyed) object before deciding there is nothing to clean.
    if (!completedObject) {
      try {
        const found = await b2.send(new HeadObjectCommand({ Bucket: B2_BUCKET, Key: payload.key }))
        completedObject = { versionId: found.VersionId }
      } catch {
        // Not found (or unreadable): nothing we can clean up.
      }
    }
    if (completedObject) {
      await b2
        .send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: payload.key, VersionId: completedObject.versionId }))
        .catch(() => {})
    }
    return NextResponse.json({ error: 'Could not finish the upload. Please try again.' }, { status: 502 })
  }
}
