import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { attachCoverPlaybackIds } from '@/lib/project-covers'
import { requireAuth } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const result = await migrationDb.query(
    `SELECT * FROM projects WHERE owner_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC`,
    [user.id]
  )

  const projects = await attachCoverPlaybackIds(result.rows)
  return NextResponse.json({ projects })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { name, client, emoji } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const membershipsResult = await migrationDb.query(
    `SELECT workspace_id, role FROM workspace_members WHERE user_id = $1`,
    [user.id]
  )
  const memberships = membershipsResult.rows

  const membership = memberships.find((m) => m.role === 'admin') ?? memberships[0]

  // A project with no workspace_id can never pass the workspace-membership
  // check in GET /api/projects/[id] or GET /api/board for anyone - reject
  // up front instead of silently creating an unreachable project.
  if (!membership) {
    return NextResponse.json({ error: 'You must belong to a workspace before creating a project' }, { status: 403 })
  }

  const result = await migrationDb.query(
    `INSERT INTO projects (name, client, emoji, owner_id, workspace_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, client ?? null, emoji ?? '🎬', user.id, membership.workspace_id]
  )

  return NextResponse.json({ project: result.rows[0] }, { status: 201 })
}