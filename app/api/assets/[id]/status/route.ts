import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { syncProjectStatus } from '@/lib/project-status'
import { requireAuth, hasWorkspaceRole, isAssignedEditor } from '@/lib/api-auth'

const PIPELINE_STATUSES = ['idea', 'editing', 'review', 'revision', 'approved']
// Moving a card TO either of these is admin-only, regardless of which
// status it's currently in - an editor can still move OUT of them freely.
const RESTRICTED_TO_ADMIN = ['revision', 'approved']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { pipeline_status } = await req.json()
  if (!PIPELINE_STATUSES.includes(pipeline_status)) {
    return NextResponse.json({ error: 'Invalid pipeline_status' }, { status: 400 })
  }

  const assetResult = await migrationDb.query(
    `SELECT a.project_id, p.workspace_id FROM assets a LEFT JOIN projects p ON p.id = a.project_id WHERE a.id = $1`,
    [params.id]
  )
  const asset = assetResult.rows[0]

  const workspaceId = asset?.workspace_id ?? null

  const isAdmin = workspaceId ? await hasWorkspaceRole(workspaceId, user.id, 'admin') : false

  const authorized = isAdmin || await isAssignedEditor(params.id, user.id)
  if (!authorized) return NextResponse.json({ error: 'Not authorized to update this asset' }, { status: 403 })

  if (RESTRICTED_TO_ADMIN.includes(pipeline_status) && !isAdmin) {
    return NextResponse.json({ error: 'Admin access required to set this status' }, { status: 403 })
  }

  const isApproved = pipeline_status === 'approved'

  const updateResult = await migrationDb.query(
    `UPDATE assets SET
       pipeline_status = $1,
       is_complete = $2,
       marked_complete_by = $3,
       marked_complete_at = $4
     WHERE id = $5
     RETURNING *`,
    [
      pipeline_status,
      isApproved,
      isApproved ? user.id : null,
      isApproved ? new Date().toISOString() : null,
      params.id,
    ]
  )
  const data = updateResult.rows[0]

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (data.project_id) await syncProjectStatus(data.project_id)
  return NextResponse.json({ asset: data })
}
