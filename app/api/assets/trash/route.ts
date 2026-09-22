import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth, hasWorkspaceRole, isAssignedEditor } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { rows: adminMemberships } = await migrationDb.query(
    `SELECT workspace_id FROM workspace_members WHERE user_id = $1 AND role = 'admin'`,
    [user.id]
  )
  const adminWorkspaceIds = adminMemberships.map((m) => m.workspace_id)

  const { rows: assignedRows } = await migrationDb.query(
    `SELECT asset_id FROM asset_editors WHERE editor_id = $1`,
    [user.id]
  )
  const assignedAssetIds = assignedRows.map((r) => r.asset_id)

  // Merge two scopes - workspace-admin and assigned-editor - the same OR
  // that /api/assets/[id]/delete checks per-asset, applied in bulk here.
  const results = new Map<string, any>()

  if (adminWorkspaceIds.length > 0) {
    const { rows } = await migrationDb.query(
      `SELECT a.id, a.name, a.project_id, a.deleted_at, p.name AS project_name
       FROM assets a
       JOIN projects p ON p.id = a.project_id
       WHERE a.deleted_at IS NOT NULL AND p.workspace_id = ANY($1::uuid[])`,
      [adminWorkspaceIds]
    )
    for (const row of rows) results.set(row.id, row)
  }

  if (assignedAssetIds.length > 0) {
    const { rows } = await migrationDb.query(
      `SELECT a.id, a.name, a.project_id, a.deleted_at, p.name AS project_name
       FROM assets a
       LEFT JOIN projects p ON p.id = a.project_id
       WHERE a.deleted_at IS NOT NULL AND a.id = ANY($1::uuid[])`,
      [assignedAssetIds]
    )
    for (const row of rows) results.set(row.id, row)
  }

  const assets = Array.from(results.values())
    .map((row) => ({
      id: row.id,
      name: row.name,
      project_id: row.project_id,
      project_name: row.project_name ?? 'Untitled project',
      deleted_at: row.deleted_at,
    }))
    .sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime())

  return NextResponse.json({ assets })
}

// Same authorization the delete endpoint itself uses - workspace admin OR
// assigned editor - so anyone who could delete an asset can also restore
// or permanently delete it from the Recycle Bin.
async function authorizeAsset(assetId: string, userId: string) {
  const { rows } = await migrationDb.query(
    `SELECT p.workspace_id
     FROM assets a
     LEFT JOIN projects p ON p.id = a.project_id
     WHERE a.id = $1`,
    [assetId]
  )
  const asset = rows[0]
  if (!asset) return { ok: false as const, status: 404, message: 'Asset not found' }

  const workspaceId = asset.workspace_id ?? null

  const isAdmin = workspaceId ? await hasWorkspaceRole(workspaceId, userId, 'admin') : false
  const authorized = isAdmin || await isAssignedEditor(assetId, userId)

  if (!authorized) return { ok: false as const, status: 403, message: 'Not authorized to manage this asset' }
  return { ok: true as const }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  // Restore a soft-deleted asset
  const { asset_id } = await req.json()
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const check = await authorizeAsset(asset_id, user.id)
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status })

  await migrationDb.query(`UPDATE assets SET deleted_at = NULL WHERE id = $1`, [asset_id])
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  // Permanently delete
  const { searchParams } = new URL(req.url)
  const asset_id = searchParams.get('asset_id')
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const check = await authorizeAsset(asset_id, user.id)
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status })

  try {
    await migrationDb.query(`DELETE FROM assets WHERE id = $1`, [asset_id])
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
