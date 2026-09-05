import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function requireAdminWorkspace(token: string) {
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return { error: 'Unauthorized', status: 401 as const }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (membershipError) return { error: membershipError.message, status: 500 as const }
  if (!membership) return { error: 'Admin access required', status: 403 as const }

  return { workspaceId: membership.workspace_id as string, userId: user.id }
}

export async function GET(req: NextRequest, { params }: { params: { editorId: string } }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requireAdminWorkspace(token)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { workspaceId } = auth

  const { data: editorMembership, error: editorMembershipError } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id, profiles(name, email)')
    .eq('workspace_id', workspaceId)
    .eq('user_id', params.editorId)
    .eq('role', 'editor')
    .maybeSingle()

  if (editorMembershipError) return NextResponse.json({ error: editorMembershipError.message }, { status: 500 })
  if (!editorMembership) return NextResponse.json({ error: 'Editor not found in your workspace' }, { status: 404 })

  const editorProfile = Array.isArray(editorMembership.profiles) ? editorMembership.profiles[0] : editorMembership.profiles

  const { data: projects, error: projectsError } = await supabaseAdmin
    .from('projects')
    .select('id, name, client, assets(id, name, version, duration_sec, status, mux_playback_id, deleted_at)')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (projectsError) return NextResponse.json({ error: projectsError.message }, { status: 500 })

  const cleanedProjects = (projects ?? []).map((project) => ({
    ...project,
    assets: (project.assets ?? []).filter((a: any) => !a.deleted_at),
  }))

  const { data: assignedRows, error: assignedError } = await supabaseAdmin
    .from('asset_editors')
    .select('asset_id')
    .eq('editor_id', params.editorId)

  if (assignedError) return NextResponse.json({ error: assignedError.message }, { status: 500 })

  return NextResponse.json({
    editor: {
      id: params.editorId,
      name: editorProfile?.name ?? 'Unknown',
      email: editorProfile?.email ?? '',
    },
    projects: cleanedProjects,
    assignedAssetIds: (assignedRows ?? []).map((r) => r.asset_id),
  })
}
