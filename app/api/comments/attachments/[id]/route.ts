import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'
import { UUID_RE, isMissingTable, purgePendingRawFiles } from '@/lib/comment-attachments'

// Remove-before-send: the uploader can discard an attachment that has not
// been posted with a comment yet. Once linked to a comment it goes only when
// the comment is deleted.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const result = await migrationDb.query(
      `SELECT rf.id, rf.b2_key FROM comment_attachments ca JOIN raw_files rf ON rf.id = ca.raw_file_id
       WHERE ca.id = $1 AND ca.uploaded_by = $2 AND ca.comment_id IS NULL`,
      [params.id, user.id],
    )
    if (!result.rows[0]) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    await purgePendingRawFiles(result.rows)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (isMissingTable(err)) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    throw err
  }
}
