import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { syncProjectStatus } from '@/lib/project-status'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { complete } = await req.json()
  if (typeof complete !== 'boolean') {
    return NextResponse.json({ error: 'complete (boolean) required' }, { status: 400 })
  }

  // Approving a cut is admin-only - an assigned editor is never authorized
  // here, regardless of asset_editors assignment.
  const assetResult = await migrationDb.query(
    `SELECT a.project_id, p.workspace_id FROM assets a LEFT JOIN projects p ON p.id = a.project_id WHERE a.id = $1`,
    [params.id]
  )
  const asset = assetResult.rows[0]

  const workspaceId = asset?.workspace_id ?? null

  const authorized = workspaceId ? await hasWorkspaceRole(workspaceId, user.id, 'admin') : false

  if (!authorized) return NextResponse.json({ error: 'Admin access required to approve a cut' }, { status: 403 })

  // Keep the Kanban board's pipeline_status and the review screen's own
  // status badge in lockstep with is_complete, so a card only ever sits
  // in the Approved column - and only ever shows as Approved on the
  // review page - while is_complete is true.
  const updateResult = await migrationDb.query(
    `UPDATE assets SET
       is_complete = $1,
       marked_complete_by = $2,
       marked_complete_at = $3,
       pipeline_status = $4,
       status = $5
     WHERE id = $6
     RETURNING *`,
    [
      complete,
      complete ? user.id : null,
      complete ? new Date().toISOString() : null,
      complete ? 'approved' : 'review',
      complete ? 'approved' : 'in_review',
      params.id,
    ]
  )
  const data = updateResult.rows[0]

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (data.project_id) await syncProjectStatus(data.project_id)
  return NextResponse.json({ asset: data })
}
