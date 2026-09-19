import { NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { getSessionUserId } from '@/lib/migrationAuth'

export async function POST(req: Request) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { invite_code } = await req.json()
  if (!invite_code) {
    return NextResponse.json({ error: 'invite_code is required' }, { status: 400 })
  }

  const workspace = await migrationDb.query('SELECT id, name FROM workspaces WHERE invite_code = $1', [invite_code])
  if (workspace.rows.length === 0) {
    return NextResponse.json({ error: 'invalid invite code' }, { status: 404 })
  }
  const workspaceId = workspace.rows[0].id

  const existing = await migrationDb.query(
    'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId]
  )
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'already a member of this workspace' }, { status: 409 })
  }

  await migrationDb.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'editor')`,
    [workspaceId, userId]
  )

  return NextResponse.json({ workspaceId, workspaceName: workspace.rows[0].name, role: 'editor' }, { status: 201 })
}
