import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { latestPerGroup } from '@/lib/asset-lineage'
import { createNotification } from '@/lib/notifications'
import { requireAuth } from '@/lib/api-auth'

async function requireAdminWorkspace(userId: string) {
  const { rows } = await migrationDb.query(
    `SELECT workspace_id FROM workspace_members WHERE user_id = $1 AND role = 'admin' LIMIT 1`,
    [userId]
  )
  const membership = rows[0]
  if (!membership) return { error: 'Admin access required', status: 403 as const }

  return { workspaceId: membership.workspace_id as string }
}

async function findAssetInWorkspace(assetId: string, workspaceId: string) {
  const { rows } = await migrationDb.query(
    `SELECT a.id, a.asset_group_id
     FROM assets a
     JOIN projects p ON p.id = a.project_id
     WHERE a.id = $1 AND p.workspace_id = $2`,
    [assetId, workspaceId]
  )
  return rows[0] ?? null
}

// Admin-only lookup of one editor's assigned Board Cut assets, scoped to the
// admin's own workspace - same asset_editors -> assets -> projects join and
// per-lineage dedup GET /api/board uses for an editor's own view, just
// parameterized by an arbitrary editor id instead of the caller's own.
export async function GET(req: NextRequest, { params }: { params: { editorId: string } }) {
  const authResult = await requireAuth(req)
  if ('error' in authResult) return authResult.error

  const auth = await requireAdminWorkspace(authResult.user.id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { rows: profileRows } = await migrationDb.query(
    `SELECT name, email FROM profiles WHERE id = $1`,
    [params.editorId]
  )
  const profile = profileRows[0]

  // Same lineage-expansion fix as GET /api/board's editor branch: asset_editors
  // pins to one specific version's row, so resolve the assigned
  // asset_group_id(s) first (auth check), then pull every version in those
  // groups for latestPerGroup to pick the true latest from.
  const { rows: assignedRows } = await migrationDb.query(
    `SELECT a.asset_group_id
     FROM asset_editors ae
     JOIN assets a ON a.id = ae.asset_id
     JOIN projects p ON p.id = a.project_id
     WHERE ae.editor_id = $1 AND a.cut_type = 'board' AND a.deleted_at IS NULL AND p.deleted_at IS NULL AND p.workspace_id = $2`,
    [params.editorId, auth.workspaceId]
  )

  const assignedGroupIds = Array.from(new Set(assignedRows.map((row: any) => row.asset_group_id)))

  let assets: any[] = []

  if (assignedGroupIds.length > 0) {
    const { rows: assetRows } = await migrationDb.query(
      `SELECT a.id, a.name, a.version, a.asset_group_id, a.pipeline_status, a.is_complete, a.project_id, a.mux_upload_id,
              p.name AS project_name, p.client AS project_client
       FROM assets a
       JOIN projects p ON p.id = a.project_id
       WHERE a.asset_group_id = ANY($1::uuid[]) AND a.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [assignedGroupIds]
    )

    assets = latestPerGroup(assetRows).map((row: any) => ({
      id: row.id,
      name: row.name,
      pipeline_status: row.pipeline_status ?? 'idea',
      is_complete: row.is_complete,
      project_id: row.project_id,
      project_name: row.project_name ?? 'Untitled project',
      project_client: row.project_client ?? '',
      mux_upload_id: row.mux_upload_id ?? null,
    }))
  }

  return NextResponse.json({
    editor: { id: params.editorId, name: profile?.name ?? profile?.email ?? 'Unknown' },
    assets,
  })
}

export async function POST(req: NextRequest, { params }: { params: { editorId: string } }) {
  const authResult = await requireAuth(req)
  if ('error' in authResult) return authResult.error

  const auth = await requireAdminWorkspace(authResult.user.id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { assetId } = await req.json()
  if (!assetId) return NextResponse.json({ error: 'assetId required' }, { status: 400 })

  const asset = await findAssetInWorkspace(assetId, auth.workspaceId)
  if (!asset) return NextResponse.json({ error: 'Asset not found in your workspace' }, { status: 404 })

  // asset_editors pins to one specific version's row, so this same editor
  // can already be assigned to an earlier version in this asset's lineage
  // (asset_group_id) without holding a row on THIS version yet - that's
  // exactly the gap the Board's admin query now resolves around. Check for
  // that before writing, so re-pointing the assignment at a new version
  // doesn't read as a brand new assignment below.
  const groupId = asset.asset_group_id ?? asset.id
  const { rows: existingInLineageRows } = await migrationDb.query(
    `SELECT ae.id
     FROM asset_editors ae
     JOIN assets a ON a.id = ae.asset_id
     WHERE ae.editor_id = $1 AND a.asset_group_id = $2
     LIMIT 1`,
    [params.editorId, groupId]
  )

  const alreadyAssignedToLineage = existingInLineageRows.length > 0

  // No unique constraint exists on (asset_id, editor_id) in CloudClusters
  // (unlike whatever Supabase had backing the old .upsert(..., { onConflict })
  // call) - guard the insert with a NOT EXISTS check instead of ON CONFLICT,
  // which would error without a matching constraint/index.
  await migrationDb.query(
    `INSERT INTO asset_editors (asset_id, editor_id)
     SELECT $1, $2
     WHERE NOT EXISTS (
       SELECT 1 FROM asset_editors WHERE asset_id = $1 AND editor_id = $2
     )`,
    [assetId, params.editorId]
  )

  // Trigger 1: notify the newly-assigned editor - but only when the
  // assignment is genuinely new to this lineage, not when it's just
  // correcting which version's row holds an assignment that was already
  // effectively in place. Best-effort - the assignment itself already
  // succeeded above regardless of this.
  if (!alreadyAssignedToLineage) {
    const { rows: assetRows } = await migrationDb.query(
      `SELECT a.project_id, p.name AS project_name
       FROM assets a
       LEFT JOIN projects p ON p.id = a.project_id
       WHERE a.id = $1`,
      [assetId]
    )
    const assetRow = assetRows[0]

    if (assetRow?.project_id) {
      await createNotification({
        userId: params.editorId,
        type: 'editor_assigned',
        message: `New project assigned: ${assetRow.project_name ?? 'Untitled project'}`,
        link: `/project/${assetRow.project_id}`,
        assetId,
      })
    }
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: { editorId: string } }) {
  const authResult = await requireAuth(req)
  if ('error' in authResult) return authResult.error

  const auth = await requireAdminWorkspace(authResult.user.id)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { assetId } = await req.json()
  if (!assetId) return NextResponse.json({ error: 'assetId required' }, { status: 400 })

  const asset = await findAssetInWorkspace(assetId, auth.workspaceId)
  if (!asset) return NextResponse.json({ error: 'Asset not found in your workspace' }, { status: 404 })

  await migrationDb.query(
    `DELETE FROM asset_editors WHERE asset_id = $1 AND editor_id = $2`,
    [assetId, params.editorId]
  )

  return NextResponse.json({ success: true })
}
