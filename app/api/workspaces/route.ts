import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Ensures the calling user has a workspace they admin, creating a default
// one on first use (e.g. the first time they open Settings > Team).
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id, workspaces(name)')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

  if (existing) {
    const workspace = Array.isArray(existing.workspaces) ? existing.workspaces[0] : existing.workspaces
    return NextResponse.json({ workspace: { id: existing.workspace_id, name: workspace?.name ?? 'Workspace' } })
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

  return NextResponse.json({ workspace: { id: workspace.id, name: workspace.name } }, { status: 201 })
}
