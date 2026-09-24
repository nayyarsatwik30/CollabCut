import { NextRequest, NextResponse } from 'next/server'
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3'
import { requireAuth } from '@/lib/api-auth'
import { b2, B2_BUCKET } from '@/lib/b2'
import { authorizeUpload } from '@/lib/raw-upload-token'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  const gate = await authorizeUpload(body?.uploadToken, user.id)
  if ('error' in gate) return gate.error
  const { payload } = gate

  try {
    await b2.send(new AbortMultipartUploadCommand({ Bucket: B2_BUCKET, Key: payload.key, UploadId: payload.uploadId }))
  } catch (err) {
    // Already completed or aborted - nothing left to clean up.
    console.error('raw-upload abort failed', (err as Error).name)
  }
  return NextResponse.json({ ok: true })
}
