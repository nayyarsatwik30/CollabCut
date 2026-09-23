import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth, hasWorkspaceRole, isAssignedEditor } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const currentResult = await migrationDb.query(
    `SELECT a.project_id, a.name, a.asset_group_id, p.workspace_id
     FROM assets a LEFT JOIN projects p ON p.id = a.project_id WHERE a.id = $1`,
    [params.id]
  )
  const current = currentResult.rows[0]

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const workspaceId = current.workspace_id ?? null

  const isAdmin = workspaceId ? await hasWorkspaceRole(workspaceId, user.id, 'admin') : false
  const authorized = isAdmin || await isAssignedEditor(params.id, user.id)

  if (!authorized) return NextResponse.json({ error: 'Not authorized to view this asset' }, { status: 403 })

  const versionsResult = await migrationDb.query(
    `SELECT id, version, name, status, created_at, size_bytes, mux_playback_id, mux_upload_id
     FROM assets WHERE project_id = $1 AND asset_group_id = $2 AND deleted_at IS NULL
     ORDER BY version DESC`,
    [current.project_id, current.asset_group_id]
  )

  return NextResponse.json({ versions: versionsResult.rows })
}