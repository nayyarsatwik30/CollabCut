import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuth, canAccessAsset } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'
import { b2, B2_BUCKET } from '@/lib/b2'
import { UUID_RE, isInlineSafe, isMissingTable } from '@/lib/comment-attachments'

const URL_TTL_SECONDS = 5 * 60

// Mints a short-lived signed B2 URL for one attachment. Authorized on every
// call: the caller must be able to access the comment's asset (admin or
// assigned editor), the asset and its project must not be in the trash, and
// an unposted (pending) attachment is visible to its uploader only.
// ?inline=1 asks for in-browser preview; honoured only for safe media types.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let row
  try {
    const result = await migrationDb.query(
      `SELECT ca.asset_id, ca.comment_id, ca.uploaded_by, rf.b2_key, rf.file_name, rf.content_type
       FROM comment_attachments ca
       JOIN raw_files rf ON rf.id = ca.raw_file_id
       JOIN assets a ON a.id = ca.asset_id
       JOIN projects p ON p.id = a.project_id
       WHERE ca.id = $1 AND a.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [params.id],
    )
    row = result.rows[0]
  } catch (err) {
    if (isMissingTable(err)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    throw err
  }

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canAccessAsset(user.id, row.asset_id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!row.comment_id && row.uploaded_by !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const wantsInline = req.nextUrl.searchParams.get('inline') === '1' && isInlineSafe(row.content_type)
  const asciiName = String(row.file_name).replace(/[^\w.\- ]/g, '_')
  const disposition = `${wantsInline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(row.file_name)}`

  try {
    const url = await getSignedUrl(
      b2,
      new GetObjectCommand({
        Bucket: B2_BUCKET,
        Key: row.b2_key,
        ResponseContentDisposition: disposition,
        ResponseContentType: row.content_type ?? 'application/octet-stream',
      }),
      { expiresIn: URL_TTL_SECONDS },
    )
    return NextResponse.json(
      { url, fileName: row.file_name, contentType: row.content_type, inline: wantsInline },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    console.error('comment attachment download presign failed', (err as Error).name)
    return NextResponse.json({ error: 'Could not prepare the file. Please try again.' }, { status: 502 })
  }
}
