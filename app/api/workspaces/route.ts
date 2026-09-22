import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'

// Read-only admin-workspace-with-plan lookup for settings.tsx's initial
// load (the Team tab's provisioning POST below is a separate, get-or-create
// concern).
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const result = await migrationDb.query(
    `SELECT w.id, w.name, w.invite_code, wp.id AS plan_id, wp.name AS plan_name,
            wp.storage_gb, wp.max_admins, wp.max_editors
     FROM workspace_members wm
     JOIN workspaces w ON w.id = wm.workspace_id
     LEFT JOIN workspace_plans wp ON wp.id = w.workspace_plan_id
     WHERE wm.user_id = $1 AND wm.role = 'admin'
     LIMIT 1`,
    [auth.user.id]
  )

  const row = result.rows[0]
  if (!row) return NextResponse.json({ workspace: null })

  return NextResponse.json({
    workspace: {
      id: row.id,
      name: row.name,
      invite_code: row.invite_code,
      workspacePlan: row.plan_id
        ? { id: row.plan_id, name: row.plan_name, storage_gb: row.storage_gb, max_admins: row.max_admins, max_editors: row.max_editors }
        : null,
    },
  })
}

// Ensures the calling user has a workspace they admin, creating a default
// one on first use (e.g. the first time they open Settings > Team) - but
// only for users who aren't in any workspace yet (see below).
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const existingResult = await migrationDb.query(
    `SELECT wm.workspace_id, w.name, w.invite_code
     FROM workspace_members wm
     JOIN workspaces w ON w.id = wm.workspace_id
     WHERE wm.user_id = $1 AND wm.role = 'admin'
     LIMIT 1`,
    [user.id]
  )
  const existing = existingResult.rows[0]

  if (existing) {
    return NextResponse.json({
      workspace: { id: existing.workspace_id, name: existing.name ?? 'Workspace', invite_code: existing.invite_code ?? '' },
    })
  }

  // Only provision for users with no workspace at all. An editor who already
  // belongs to someone else's workspace must never be handed an admin row
  // here: every role check (dashboard, /api/board, New Content) resolves
  // "admin wins", so a silent self-provisioned admin workspace flips that
  // editor's whole UI to an empty admin view of the new workspace.
  const anyMembershipResult = await migrationDb.query(
    `SELECT 1 FROM workspace_members WHERE user_id = $1 LIMIT 1`,
    [user.id]
  )
  if (anyMembershipResult.rows.length > 0) {
    return NextResponse.json(
      { error: 'Only workspace admins can invite team members.' },
      { status: 403 }
    )
  }

  const profileResult = await migrationDb.query(`SELECT name FROM profiles WHERE id = $1`, [user.id])
  const profile = profileResult.rows[0]

  const workspaceName = profile?.name ? `${profile.name}'s Workspace` : 'My Workspace'

  const workspaceResult = await migrationDb.query(
    `INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING *`,
    [workspaceName, user.id]
  )
  const workspace = workspaceResult.rows[0]

  await migrationDb.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')`,
    [workspace.id, user.id]
  )

  return NextResponse.json(
    { workspace: { id: workspace.id, name: workspace.name, invite_code: workspace.invite_code } },
    { status: 201 }
  )
}
