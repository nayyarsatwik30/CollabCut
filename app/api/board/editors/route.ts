import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'

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

  const assetCountByEditor = new Map<string, number>()
  if (editorIds.length > 0) {
    const { rows: assignmentRows } = await migrationDb.query(
      `SELECT editor_id FROM asset_editors WHERE editor_id = ANY($1::uuid[])`,
      [editorIds]
    )

    for (const row of assignmentRows) {
      assetCountByEditor.set(row.editor_id, (assetCountByEditor.get(row.editor_id) ?? 0) + 1)
    }
  }

  const editors = editorRows.map((row) => ({
    id: row.user_id,
    name: row.name ?? 'Unknown',
    email: row.email ?? '',
    assetCount: assetCountByEditor.get(row.user_id) ?? 0,
  }))

  return NextResponse.json({ workspace_id: membership.workspace_id, editors })
}
