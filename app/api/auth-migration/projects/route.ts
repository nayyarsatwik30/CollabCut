import { NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { getSessionUserId, getUserWorkspaceId } from '@/lib/migrationAuth'

export async function POST(req: Request) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { name, client: clientName } = await req.json()
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const workspaceId = await getUserWorkspaceId(userId)
  if (!workspaceId) {
    return NextResponse.json({ error: 'no workspace found for user' }, { status: 404 })
  }

  const result = await migrationDb.query(
    `INSERT INTO projects (owner_id, workspace_id, name, client)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, client, status, emoji, created_at`,
    [userId, workspaceId, name, clientName ?? null]
  )

  return NextResponse.json(result.rows[0], { status: 201 })
}

export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const workspaceId = await getUserWorkspaceId(userId)
  if (!workspaceId) {
    return NextResponse.json({ error: 'no workspace found for user' }, { status: 404 })
  }

  const result = await migrationDb.query(
    `SELECT id, name, client, status, emoji, created_at
     FROM projects
     WHERE workspace_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [workspaceId]
  )

  return NextResponse.json(result.rows)
}
