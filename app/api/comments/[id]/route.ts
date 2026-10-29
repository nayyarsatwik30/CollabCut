import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth, hasWorkspaceRole, isAssignedEditor } from '@/lib/api-auth'
import { isMissingTable, purgeRawFiles } from '@/lib/comment-attachments'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const commentResult = await migrationDb.query(
    `SELECT asset_id FROM comments WHERE id = $1`,
    [params.id]
  )
  const comment = commentResult.rows[0]

  if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

  const assetResult = await migrationDb.query(
    `SELECT p.workspace_id FROM assets a
     JOIN projects p ON p.id = a.project_id
     WHERE a.id = $1`,
    [comment.asset_id]
  )
  const workspaceId = assetResult.rows[0]?.workspace_id ?? null

  const isAdmin = workspaceId ? await hasWorkspaceRole(workspaceId, user.id, 'admin') : false
  const authorized = isAdmin || await isAssignedEditor(comment.asset_id, user.id)

  if (!authorized) return NextResponse.json({ error: 'Not authorized to update this comment' }, { status: 403 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const field of ['resolved', 'status'] as const) {
    if (field in body) updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const setClauses = Object.keys(updates).map((field, i) => `${field} = $${i + 2}`)
  const result = await migrationDb.query(
    `UPDATE comments SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    [params.id, ...Object.values(updates)]
  )

  return NextResponse.json({ comment: result.rows[0] })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const commentResult = await migrationDb.query(
    `SELECT author_id, asset_id FROM comments WHERE id = $1`,
    [params.id]
  )
  const comment = commentResult.rows[0]

  if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

  let authorized = comment.author_id === user.id

  if (!authorized) {
    const assetResult = await migrationDb.query(
      `SELECT p.workspace_id FROM assets a
       JOIN projects p ON p.id = a.project_id
       WHERE a.id = $1`,
      [comment.asset_id]
    )
    const workspaceId = assetResult.rows[0]?.workspace_id ?? null

    authorized = workspaceId ? await hasWorkspaceRole(workspaceId, user.id, 'admin') : false
  }

  if (!authorized) return NextResponse.json({ error: 'Not authorized to delete this comment' }, { status: 403 })

  // Files attached to the note go with it (storage rows + B2 objects), so a
  // deleted comment leaves nothing reachable or counted against quota.
  let attachmentFiles: { id: string; b2_key: string }[] = []
  try {
    const attachments = await migrationDb.query(
      `SELECT rf.id, rf.b2_key FROM comment_attachments ca JOIN raw_files rf ON rf.id = ca.raw_file_id
       WHERE ca.comment_id = $1`,
      [params.id]
    )
    attachmentFiles = attachments.rows
  } catch (err) {
    if (!isMissingTable(err)) throw err
  }

  await migrationDb.query(`DELETE FROM comments WHERE id = $1`, [params.id])
  await purgeRawFiles(attachmentFiles)

  return NextResponse.json({ success: true })
}