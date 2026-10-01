import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'

const VALID_PRIORITIES = [1, 2, 3]

// Admin-only: editors can see priority everywhere but never change it, so
// unlike /api/assets/[id]/status there is no isAssignedEditor fallback here.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { priority } = await req.json()
  if (!VALID_PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: 'priority must be 1, 2, or 3' }, { status: 400 })
  }

  const assetResult = await migrationDb.query(
    `SELECT a.asset_group_id, a.deleted_at, p.workspace_id, p.deleted_at AS project_deleted_at
     FROM assets a LEFT JOIN projects p ON p.id = a.project_id
     WHERE a.id = $1`,
    [params.id]
  )
  const asset = assetResult.rows[0]

  // A trashed asset, or one in a trashed project, is gone as far as every
  // other view is concerned - same rule GET /api/assets/[id] uses.
  if (!asset || asset.deleted_at || asset.project_deleted_at) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const workspaceId = asset.workspace_id ?? null
  const isAdmin = workspaceId ? await hasWorkspaceRole(workspaceId, user.id, 'admin') : false
  if (!isAdmin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  // Priority is kept in sync across every version in the lineage, so
  // whichever row a listing query's latestPerGroup() happens to pick always
  // has the current value with no extra lookup. A null asset_group_id means
  // this row has no lineage to sync - update just itself. Re-scoped through
  // projects.workspace_id here too (not just asset_group_id) so the write
  // itself can't cross a workspace boundary even if some future lineage
  // ever ended up sharing a group id across workspaces.
  const updateResult = asset.asset_group_id
    ? await migrationDb.query(
        `UPDATE assets a SET priority = $1
         FROM projects p
         WHERE a.project_id = p.id AND a.asset_group_id = $2 AND p.workspace_id = $3
         RETURNING a.id`,
        [priority, asset.asset_group_id, workspaceId]
      )
    : await migrationDb.query(
        `UPDATE assets a SET priority = $1
         FROM projects p
         WHERE a.project_id = p.id AND a.id = $2 AND p.workspace_id = $3
         RETURNING a.id`,
        [priority, params.id, workspaceId]
      )

  return NextResponse.json({ success: true, updated: updateResult.rows.length })
}
