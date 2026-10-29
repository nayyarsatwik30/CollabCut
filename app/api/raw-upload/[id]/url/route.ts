import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'
import { b2, B2_BUCKET } from '@/lib/b2'
import { canonicalContentType, canPreviewRawFile, classifyRawFile } from '@/lib/raw-files'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/raw-upload/:id/url?download=1 -> { url }
// Short-lived presigned B2 URL for one raw file. Same gate as list/delete:
// admin of the project's workspace. `download=1` forces a save-as with the
// original file name; otherwise the URL is for inline preview/playback.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const result = await migrationDb.query(
    `SELECT rf.b2_key, rf.file_name, rf.content_type, rf.file_size_bytes, p.workspace_id
     FROM raw_files rf JOIN projects p ON p.id = rf.project_id
     WHERE rf.id = $1 AND p.deleted_at IS NULL`,
    [params.id],
  )
  const row = result.rows[0]
  if (!row?.workspace_id) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const isAdmin = await hasWorkspaceRole(row.workspace_id, user.id, 'admin')
  if (!isAdmin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const download = req.nextUrl.searchParams.get('download') === '1'
  const kind = classifyRawFile(row.file_name, row.content_type)
  // Inline only for photo/audio a browser can render, always with a
  // server-chosen type; everything else is forced to download.
  const inline = !download && canPreviewRawFile(row.file_name, kind, row.file_size_bytes)
  const asciiName = String(row.file_name).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  try {
    const url = await getSignedUrl(
      b2,
      new GetObjectCommand({
        Bucket: B2_BUCKET,
        Key: row.b2_key,
        ResponseContentType: canonicalContentType(row.file_name, kind),
        ResponseContentDisposition: inline
          ? 'inline'
          : `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(row.file_name).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())}`,
      }),
      { expiresIn: 15 * 60 },
    )
    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('raw-upload url presign failed', (err as Error).name)
    return NextResponse.json({ error: 'Could not prepare the file. Please try again.' }, { status: 502 })
  }
}
