import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { rows } = await migrationDb.query(
    `SELECT a.id, a.name, a.status, a.is_complete, a.mux_playback_id,
            p.id AS project_id, p.name AS project_name, p.client AS project_client
     FROM asset_editors ae
     JOIN assets a ON a.id = ae.asset_id
     LEFT JOIN projects p ON p.id = a.project_id
     WHERE ae.editor_id = $1 AND a.deleted_at IS NULL AND p.deleted_at IS NULL`,
    [user.id]
  )

  const assets = rows.map((asset: any) => ({
    id: asset.id,
    name: asset.name,
    status: asset.status,
    is_complete: asset.is_complete,
    mux_playback_id: asset.mux_playback_id ?? null,
    project_id: asset.project_id ?? null,
    project_name: asset.project_name ?? 'Untitled project',
    project_client: asset.project_client ?? '',
  }))

  return NextResponse.json({ assets })
}
