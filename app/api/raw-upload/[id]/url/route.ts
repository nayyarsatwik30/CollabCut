import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'
import { b2, B2_BUCKET } from '@/lib/b2'

// GET /api/raw-upload/:id/url?download=1 -> { url }
// Short-lived presigned B2 URL for one raw file. Same gate as list/delete:
// admin of the project's workspace. `download=1` forces a save-as with the
// original file name; otherwise the URL is for inline preview/playback.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const result = await migrationDb.query(
    `SELECT rf.b2_key, rf.file_name, rf.content_type, p.workspace_id
     FROM raw_files rf JOIN projects p ON p.id = rf.project_id
     WHERE rf.id = $1`,
    [params.id],
  )
  const row = result.rows[0]
  if (!row?.workspace_id) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const isAdmin = await hasWorkspaceRole(row.workspace_id, user.id, 'admin')
  if (!isAdmin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const download = req.nextUrl.searchParams.get('download') === '1'
  const asciiName = String(row.file_name).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  try {
    const url = await getSignedUrl(
      b2,
      new GetObjectCommand({
        Bucket: B2_BUCKET,
        Key: row.b2_key,
        ...(download
          ? { ResponseContentDisposition: `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(row.file_name)}` }
          : {}),
      }),
      { expiresIn: 15 * 60 },
    )
    return NextResponse.json({ url })
  } catch (err) {
    console.error('raw-upload url presign failed', (err as Error).name)
    return NextResponse.json({ error: 'Could not prepare the file. Please try again.' }, { status: 502 })
  }
}
