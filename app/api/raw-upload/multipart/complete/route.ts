import { NextRequest, NextResponse } from 'next/server'
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  type Part,
} from '@aws-sdk/client-s3'
import { requireAuth } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'
import { b2, B2_BUCKET } from '@/lib/b2'
import { MAX_RAW_FILE_BYTES } from '@/lib/raw-files'
import { MIN_PART_SIZE, authorizeUpload } from '@/lib/raw-upload-token'

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

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  const gate = await authorizeUpload(body?.uploadToken, user.id)
  if ('error' in gate) return gate.error
  const { payload } = gate

  // Double submit: the upload already finished and was recorded.
  const existing = await migrationDb.query(`SELECT * FROM raw_files WHERE b2_key = $1 LIMIT 1`, [payload.key])
  if (existing.rows[0]) return NextResponse.json({ rawFile: existing.rows[0] }, { status: 200 })

  try {
    // The parts B2 actually holds are the only source of truth - nothing
    // about ETags or sizes is taken from the client.
    const parts = await listAllParts(payload.key, payload.uploadId)

    const contiguous =
      parts.length === payload.totalParts && parts.every((p, i) => p.PartNumber === i + 1 && !!p.ETag)
    if (!contiguous) {
      return NextResponse.json({ error: 'Some parts of the upload are missing. Please retry.' }, { status: 400 })
    }

    const total = parts.reduce((sum, p) => sum + (p.Size ?? 0), 0)
    const smallPart = parts.slice(0, -1).some((p) => (p.Size ?? 0) < MIN_PART_SIZE)
    if (smallPart || total !== payload.declaredSize || total > MAX_RAW_FILE_BYTES) {
      await b2.send(new AbortMultipartUploadCommand({ Bucket: B2_BUCKET, Key: payload.key, UploadId: payload.uploadId })).catch(() => {})
      return NextResponse.json({ error: 'The uploaded file did not match its declared size.' }, { status: 400 })
    }

    await b2.send(
      new CompleteMultipartUploadCommand({
        Bucket: B2_BUCKET,
        Key: payload.key,
        UploadId: payload.uploadId,
        MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag })) },
      }),
    )

    const head = await b2.send(new HeadObjectCommand({ Bucket: B2_BUCKET, Key: payload.key }))
    const size = head.ContentLength ?? 0
    if (size <= 0 || size > MAX_RAW_FILE_BYTES || size !== payload.declaredSize) {
      await b2.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: payload.key })).catch(() => {})
      return NextResponse.json({ error: 'The uploaded file did not match its declared size.' }, { status: 400 })
    }

    const insertResult = await migrationDb.query(
      `INSERT INTO raw_files (project_id, uploaded_by, file_name, b2_key, file_size_bytes, content_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [payload.projectId, user.id, payload.safeName, payload.key, size, payload.contentType],
    )
    return NextResponse.json({ rawFile: insertResult.rows[0] }, { status: 201 })
  } catch (err) {
    console.error('raw-upload complete failed', (err as Error).name)
    return NextResponse.json({ error: 'Could not finish the upload. Please try again.' }, { status: 502 })
  }
}
