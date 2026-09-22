import { NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { getSessionUserId, getUserWorkspaceId } from '@/lib/migrationAuth'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await migrationDb.query(
    `SELECT a.id, a.project_id, a.name, a.status, a.duration_sec,
            a.mux_playback_id, a.mux_asset_id, a.created_at, p.workspace_id
     FROM assets a
     JOIN projects p ON p.id = a.project_id
     WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [params.id]
  )
  const asset = result.rows[0]
  if (!asset) {
    return NextResponse.json({ error: 'asset not found' }, { status: 404 })
  }

  const workspaceId = await getUserWorkspaceId(userId)
  if (!workspaceId || workspaceId !== asset.workspace_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { workspace_id: _workspaceId, ...assetDetails } = asset
  return NextResponse.json(assetDetails)
}
