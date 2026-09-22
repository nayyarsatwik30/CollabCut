import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { latestPerGroup } from '@/lib/asset-lineage'
import { requireAuth } from '@/lib/api-auth'

interface BoardAsset {
  id: string
  name: string
  pipeline_status: string
  is_complete: boolean
  project_id: string
  project_name: string
  project_client: string
  editor: { id: string; name: string } | null
  mux_upload_id: string | null
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const membershipResult = await migrationDb.query(
    `SELECT workspace_id, role FROM workspace_members WHERE user_id = $1`,
    [user.id]
  )
  const memberships = membershipResult.rows

  const membership = memberships.find((m) => m.role === 'admin')
    ?? memberships.find((m) => m.role === 'editor')

  if (!membership) return NextResponse.json({ error: 'No workspace access' }, { status: 403 })

  const role = membership.role as 'admin' | 'editor'
  const workspaceId = membership.workspace_id as string

  let assets: BoardAsset[] = []

  if (role === 'admin') {
    const { rows: assetRows } = await migrationDb.query(
      `SELECT a.id, a.name, a.version, a.asset_group_id, a.pipeline_status, a.is_complete, a.project_id, a.mux_upload_id,
              p.name AS project_name, p.client AS project_client
       FROM assets a
       JOIN projects p ON p.id = a.project_id
       WHERE p.workspace_id = $1 AND a.cut_type = 'board' AND a.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [workspaceId]
    )

    const latestRows = latestPerGroup(assetRows)

    // Same lineage gap the editor branch below already works around:
    // asset_editors pins to one specific version's row, not the whole
    // lineage, so a join on this exact (latest) row's id goes empty the
    // moment a new version is uploaded without a fresh assignment. Resolve
    // the assigned editor per asset_group_id across every version instead.
    const groupIds = Array.from(new Set(latestRows.map((row: any) => row.asset_group_id ?? row.id)))
    const editorByGroup = new Map<string, { id: string; name: string }>()

    if (groupIds.length > 0) {
      const { rows: editorRows } = await migrationDb.query(
        `SELECT ae.editor_id, pr.name AS editor_name, a.asset_group_id
         FROM asset_editors ae
         JOIN assets a ON a.id = ae.asset_id
         JOIN profiles pr ON pr.id = ae.editor_id
         WHERE a.asset_group_id = ANY($1::uuid[])`,
        [groupIds]
      )

      for (const row of editorRows) {
        const groupId = row.asset_group_id
        if (!groupId || editorByGroup.has(groupId)) continue
        editorByGroup.set(groupId, { id: row.editor_id, name: row.editor_name ?? 'Unknown' })
      }
    }

    assets = latestRows.map((row: any) => ({
      id: row.id,
      name: row.name,
      pipeline_status: row.pipeline_status ?? 'idea',
      is_complete: row.is_complete,
      project_id: row.project_id,
      project_name: row.project_name ?? 'Untitled project',
      project_client: row.project_client ?? '',
      editor: editorByGroup.get(row.asset_group_id ?? row.id) ?? null,
      mux_upload_id: row.mux_upload_id ?? null,
    }))
  } else {
    const { rows: profileRows } = await migrationDb.query(
      `SELECT name FROM profiles WHERE id = $1`,
      [user.id]
    )
    const myProfile = profileRows[0]

    // asset_editors pins an assignment to one specific version's row, not the
    // whole lineage - resolve which asset_group_id(s) this editor is assigned
    // to first (auth check), then pull every version in those groups so
    // latestPerGroup has the sibling versions to actually pick a latest from.
    // It can't promote a version it was never given.
    const { rows: assignedRows } = await migrationDb.query(
      `SELECT a.asset_group_id
       FROM asset_editors ae
       JOIN assets a ON a.id = ae.asset_id
       JOIN projects p ON p.id = a.project_id
       WHERE ae.editor_id = $1 AND a.cut_type = 'board' AND a.deleted_at IS NULL AND p.deleted_at IS NULL AND p.workspace_id = $2`,
      [user.id, workspaceId]
    )

    const assignedGroupIds = Array.from(new Set(assignedRows.map((row: any) => row.asset_group_id)))

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
        editor: { id: user.id, name: myProfile?.name ?? user.email ?? 'You' },
        mux_upload_id: row.mux_upload_id ?? null,
      }))
    }
  }

  return NextResponse.json({ role, workspace_id: workspaceId, assets })
}
