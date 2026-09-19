import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'

// Read-only admin-workspace-with-plan lookup for settings.tsx's initial
// load (the Team tab's provisioning POST below is a separate, get-or-create
// concern). migrationDb rather than supabaseAdmin like POST below - this
// handler is new, so it targets CloudClusters directly instead of adding to
// what still needs converting in the pending 30-routes pass.
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
// one on first use (e.g. the first time they open Settings > Team).
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id, workspaces(name, invite_code)')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

  if (existing) {
    const workspace = Array.isArray(existing.workspaces) ? existing.workspaces[0] : existing.workspaces
    return NextResponse.json({
      workspace: { id: existing.workspace_id, name: workspace?.name ?? 'Workspace', invite_code: workspace?.invite_code ?? '' },
    })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  const workspaceName = profile?.name ? `${profile.name}'s Workspace` : 'My Workspace'

  const { data: workspace, error: workspaceError } = await supabaseAdmin
    .from('workspaces')
    .insert({ name: workspaceName, owner_id: user.id })
    .select()
    .single()

  if (workspaceError) return NextResponse.json({ error: workspaceError.message }, { status: 500 })

  const { error: memberError } = await supabaseAdmin
    .from('workspace_members')
    .insert({ workspace_id: workspace.id, user_id: user.id, role: 'admin' })

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  return NextResponse.json(
    { workspace: { id: workspace.id, name: workspace.name, invite_code: workspace.invite_code } },
    { status: 201 }
  )
}
