import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { CreateMultipartUploadCommand } from '@aws-sdk/client-s3'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'
import { b2, B2_BUCKET } from '@/lib/b2'
import { MAX_RAW_FILE_BYTES } from '@/lib/raw-files'
import { PART_SIZE, TOKEN_TTL_MS, safeContentType, sanitizeFileName, signUploadToken } from '@/lib/raw-upload-token'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  const projectId = body?.projectId
  const fileSize = body?.fileSize

  if (typeof projectId !== 'string' || !projectId || typeof fileSize !== 'number' || !Number.isInteger(fileSize)) {
    return NextResponse.json({ error: 'projectId, fileName and fileSize required' }, { status: 400 })
  }
  if (fileSize <= 0) return NextResponse.json({ error: 'File is empty' }, { status: 400 })
  if (fileSize > MAX_RAW_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds the 750MB archival limit' }, { status: 400 })
  }

  const projectResult = await migrationDb.query(`SELECT workspace_id FROM projects WHERE id = $1`, [projectId])
  const project = projectResult.rows[0]
  if (!project?.workspace_id) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const isAdmin = await hasWorkspaceRole(project.workspace_id, user.id, 'admin')
  if (!isAdmin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const safeName = sanitizeFileName(body?.fileName)
  const contentType = safeContentType(body?.contentType)
  const key = `${projectId}/${randomUUID()}-${safeName}`

  try {
    const created = await b2.send(new CreateMultipartUploadCommand({ Bucket: B2_BUCKET, Key: key, ContentType: contentType }))
    if (!created.UploadId) throw new Error('No upload id returned')

    const totalParts = Math.ceil(fileSize / PART_SIZE)
    const uploadToken = signUploadToken({
      userId: user.id,
      projectId,
      key,
      uploadId: created.UploadId,
      safeName,
      contentType,
      declaredSize: fileSize,
      totalParts,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    })
    return NextResponse.json({ uploadToken, partSize: PART_SIZE, totalParts })
  } catch (err) {
    console.error('raw-upload initiate failed', (err as Error).name)
    return NextResponse.json({ error: 'Could not start the upload. Please try again.' }, { status: 502 })
  }
}
