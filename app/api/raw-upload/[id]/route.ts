import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'
import { b2, B2_BUCKET } from '@/lib/b2'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const rawFileResult = await migrationDb.query(
    `SELECT rf.id, rf.b2_key, rf.project_id, p.workspace_id
     FROM raw_files rf
     JOIN projects p ON p.id = rf.project_id
     WHERE rf.id = $1`,
    [params.id]
  )
  const rawFile = rawFileResult.rows[0]

  if (!rawFile?.workspace_id) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const isAdmin = await hasWorkspaceRole(rawFile.workspace_id, user.id, 'admin')
  if (!isAdmin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  try {
    await b2.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: rawFile.b2_key }))
  } catch (err) {
    // B2 cleanup failure shouldn't block removing the row - log and continue.
    console.error('B2 delete failed for', rawFile.b2_key, err)
  }

  await migrationDb.query(`DELETE FROM raw_files WHERE id = $1`, [params.id])

  return NextResponse.json({ success: true })
}
