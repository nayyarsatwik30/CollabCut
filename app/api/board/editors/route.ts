import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { latestPerGroup } from '@/lib/asset-lineage'
import { requireAuth } from '@/lib/api-auth'

const PREVIEW_LIMIT = 3

interface LineageRow {
  editor_id: string
  id: string
  name: string
  version: number
  asset_group_id: string | null
  pipeline_status: string
  created_at: string
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { rows: membershipRows } = await migrationDb.query(
    `SELECT workspace_id FROM workspace_members WHERE user_id = $1 AND role = 'admin' LIMIT 1`,
    [user.id]
  )
  const membership = membershipRows[0]
  if (!membership) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { rows: editorRows } = await migrationDb.query(
    `SELECT wm.user_id, p.name, p.email
     FROM workspace_members wm
     JOIN profiles p ON p.id = wm.user_id
     WHERE wm.workspace_id = $1 AND wm.role = 'editor'`,
    [membership.workspace_id]
  )

  const editorIds = editorRows.map((row) => row.user_id)

  // Same lineage-dedup + trashed-exclusion as GET /api/board/editor/[editorId]/assets,
  // but one query covering every editor on the Board instead of one per card.
  const cutsByEditor = new Map<string, LineageRow[]>()
  if (editorIds.length > 0) {
    const { rows: assetRows } = await migrationDb.query(
      `SELECT ae.editor_id, a.id, a.name, a.version, a.asset_group_id, a.pipeline_status, a.created_at
       FROM asset_editors ae
       JOIN assets a ON a.id = ae.asset_id
       JOIN projects p ON p.id = a.project_id
       WHERE ae.editor_id = ANY($1::uuid[]) AND a.cut_type = 'board' AND a.deleted_at IS NULL AND p.deleted_at IS NULL AND p.workspace_id = $2`,
      [editorIds, membership.workspace_id]
    )

    for (const row of assetRows as LineageRow[]) {
      const list = cutsByEditor.get(row.editor_id)
      if (list) list.push(row)
      else cutsByEditor.set(row.editor_id, [row])
    }
  }

  const editors = editorRows.map((row) => {
    const activeCuts = latestPerGroup(cutsByEditor.get(row.user_id) ?? [])
      .filter((cut) => cut.pipeline_status !== 'approved')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return {
      id: row.user_id,
      name: row.name ?? 'Unknown',
      email: row.email ?? '',
      assetCount: activeCuts.length,
      cutsPreview: activeCuts.slice(0, PREVIEW_LIMIT).map((cut) => ({
        id: cut.id,
        title: cut.name,
        status: cut.pipeline_status,
      })),
    }
  })

  return NextResponse.json({ workspace_id: membership.workspace_id, editors })
}
