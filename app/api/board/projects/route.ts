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

  const { rows: projects } = await migrationDb.query(
    `SELECT id, name, client, emoji, status
     FROM projects
     WHERE workspace_id = $1 AND deleted_at IS NULL
     ORDER BY name ASC`,
    [membership.workspace_id]
  )

  return NextResponse.json({ projects })
}
