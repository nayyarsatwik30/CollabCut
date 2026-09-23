import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { createNotification } from '@/lib/notifications'
import { syncProjectStatus } from '@/lib/project-status'
import { requireAuth, hasWorkspaceRole, canAccessAsset } from '@/lib/api-auth'
import { verifyShareAccess } from '@/lib/share-access'

// Comments are readable by a logged-in admin/assigned editor (the review
// screen) OR by anyone holding a valid, non-expired, correctly-passworded
// share link for this exact asset (the public /r/[token] page) - never by
// neither. Knowing an asset's UUID alone is not enough.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const asset_id = url.searchParams.get('asset_id')
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const shareToken = url.searchParams.get('share_token')
  let authorized = false

  if (shareToken) {
    authorized = await verifyShareAccess(asset_id, shareToken, url.searchParams.get('share_password'))
  } else {
    const auth = await requireAuth(req)
    if (!('error' in auth)) authorized = await canAccessAsset(auth.user.id, asset_id)
  }

  if (!authorized) return NextResponse.json({ error: 'Not authorized to view these comments' }, { status: 403 })

  const commentsResult = await migrationDb.query(
    `SELECT * FROM comments WHERE asset_id = $1 ORDER BY time_sec ASC`,
    [asset_id]
  )
  const comments = commentsResult.rows

  const repliesResult = await migrationDb.query(
    `SELECT * FROM replies WHERE comment_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
    [comments.map((c) => c.id)]
  )
  const repliesByComment = new Map<string, unknown[]>()
  for (const reply of repliesResult.rows) {
    if (!repliesByComment.has(reply.comment_id)) repliesByComment.set(reply.comment_id, [])
    repliesByComment.get(reply.comment_id)!.push(reply)
  }

  return NextResponse.json({
    comments: comments.map((c) => ({ ...c, replies: repliesByComment.get(c.id) ?? [] })),
  })
}

// No share-token path here - the public page posts comments through the
// dedicated, already-token-verified /api/share/comments instead. This one
// is for the review screen only: admin or assigned editor, full stop.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { asset_id, time_sec, text, status } = await req.json()

  if (!asset_id || time_sec === undefined || !text) {
    return NextResponse.json({ error: 'asset_id, time_sec and text required' }, { status: 400 })
  }

  const authorized = await canAccessAsset(user.id, asset_id)
  if (!authorized) return NextResponse.json({ error: 'Not authorized to comment on this asset' }, { status: 403 })

  // Always attributed to the caller's own profile - never a name from the
  // request body, which anyone could set to someone else's.
  const profileResult = await migrationDb.query(`SELECT name, email FROM profiles WHERE id = $1`, [user.id])
  const profile = profileResult.rows[0]
  const authorName = profile?.name || profile?.email || user.email || 'Unknown'

  const insertResult = await migrationDb.query(
    `INSERT INTO comments (asset_id, time_sec, text, status, author_id, author_name)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [asset_id, time_sec, text, status ?? 'open', user.id, authorName]
  )
  const data = insertResult.rows[0]

  // Single lookup, reused below for both the pipeline_status transition and
  // Trigger 3 (notification). Same asset/project/workspace_id shape either
  // consumer needs.
  const assetRowResult = await migrationDb.query(
    `SELECT a.project_id, a.pipeline_status, p.name AS project_name, p.workspace_id
     FROM assets a JOIN projects p ON p.id = a.project_id
     WHERE a.id = $1`,
    [asset_id]
  )
  const assetRow = assetRowResult.rows[0] ?? null
  const project = assetRow ? { name: assetRow.project_name, workspace_id: assetRow.workspace_id } : null

  const isAdminCommenter = project?.workspace_id
    ? await hasWorkspaceRole(project.workspace_id, user.id, 'admin')
    : false

  // Auto-transition: an admin's comment on an asset in Review implies
  // changes are needed, so move it to Revision - mirroring the manual
  // transition in PATCH /api/assets/[id]/status. Editor comments (assigned
  // or not) never trigger this, and it only fires out of 'review' so it
  // can't clobber e.g. an already-approved asset.
  if (isAdminCommenter && assetRow?.pipeline_status === 'review') {
    await migrationDb.query(`UPDATE assets SET pipeline_status = 'revision' WHERE id = $1`, [asset_id])
    if (assetRow.project_id) await syncProjectStatus(assetRow.project_id)
  }

  // Trigger 3: only when the commenter is an admin (not the assigned editor
  // commenting on their own upload), and only if someone is actually
  // assigned to notify. Best-effort - the comment itself already succeeded.
  if (isAdminCommenter) {
    const assignmentResult = await migrationDb.query(
      `SELECT editor_id FROM asset_editors WHERE asset_id = $1 LIMIT 1`,
      [asset_id]
    )
    const assignment = assignmentResult.rows[0] ?? null

    if (assignment?.editor_id) {
      await createNotification({
        userId: assignment.editor_id,
        type: 'comment_added',
        message: `New comment on ${project?.name ?? 'Untitled project'}`,
        link: `/review/${asset_id}`,
        assetId: asset_id,
      })
    }
  }

  return NextResponse.json({ comment: data }, { status: 201 })
}