import { NextRequest, NextResponse } from 'next/server'
import { UploadPartCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuth } from '@/lib/api-auth'
import { b2, B2_BUCKET } from '@/lib/b2'
import { MAX_PART_URLS_PER_REQUEST, PART_SIZE, authorizeUpload } from '@/lib/raw-upload-token'

const URL_TTL_SECONDS = 60 * 60

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  const gate = await authorizeUpload(body?.uploadToken, user.id)
  if ('error' in gate) return gate.error
  const { payload } = gate

  const partNumbers = body?.partNumbers
  if (
    !Array.isArray(partNumbers) ||
    partNumbers.length === 0 ||
    partNumbers.length > MAX_PART_URLS_PER_REQUEST ||
    !partNumbers.every((n) => Number.isInteger(n) && n >= 1 && n <= payload.totalParts)
  ) {
    return NextResponse.json({ error: 'Invalid part numbers' }, { status: 400 })
  }

  try {
    const urls = await Promise.all(
      (partNumbers as number[]).map(async (partNumber) => {
        // Every part but the last is exactly PART_SIZE; the length is part of
        // the signature, so a URL can't be used to upload a different size.
        const isLast = partNumber === payload.totalParts
        const contentLength = isLast ? payload.declaredSize - PART_SIZE * (payload.totalParts - 1) : PART_SIZE
        const url = await getSignedUrl(
          b2,
          new UploadPartCommand({
            Bucket: B2_BUCKET,
            Key: payload.key,
            UploadId: payload.uploadId,
            PartNumber: partNumber,
            ContentLength: contentLength,
          }),
          { expiresIn: URL_TTL_SECONDS, signableHeaders: new Set(['content-length']) },
        )
        return { partNumber, url }
      }),
    )
    return NextResponse.json({ urls })
  } catch (err) {
    console.error('raw-upload part presign failed', (err as Error).name)
    return NextResponse.json({ error: 'Could not prepare the upload. Please try again.' }, { status: 502 })
  }
}
