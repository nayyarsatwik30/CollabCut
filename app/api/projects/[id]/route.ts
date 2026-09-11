import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'
import { latestPerGroup } from '@/lib/asset-lineage'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*, assets(id, name, version, asset_group_id, duration_sec, size_bytes, status, mux_playback_id, mux_upload_id, is_complete, cut_type)')
    .eq('id', params.id)
    .is('assets.deleted_at', null)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // .eq('workspace_id', null) compiles to `workspace_id = null`, which SQL
  // never evaluates true - a project with no workspace can't rely on that,
  // it has to be excluded up front instead.
  let authorized = false

  if (data.workspace_id) {
    const { data: membership } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', data.workspace_id)
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    authorized = !!membership
  }

  if (!authorized) {
    const { data: assignment } = await supabaseAdmin
      .from('asset_editors')
      .select('id, assets!inner(project_id)')
      .eq('editor_id', user.id)
      .eq('assets.project_id', params.id)
      .limit(1)
      .maybeSingle()

    authorized = !!assignment
  }

  if (!authorized) return NextResponse.json({ error: 'Not authorized to view this project' }, { status: 403 })

  if (data?.assets) {
    data.assets = latestPerGroup(data.assets)
  }

  const { data: ownerProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, avatar_color')
    .eq('id', data.owner_id)
    .maybeSingle()

  // Members = editors actually assigned to an asset in this project, per
  // asset_editors - there's no separate project-membership table for this.
  const { data: editorRows } = await supabaseAdmin
    .from('asset_editors')
    .select('editor_id, profiles(id, name, email, avatar_color), assets!inner(project_id, deleted_at)')
    .eq('assets.project_id', params.id)
    .is('assets.deleted_at', null)

  const seenEditors = new Set<string>()
  const members = []
  for (const row of editorRows ?? []) {
    if (seenEditors.has(row.editor_id)) continue
    seenEditors.add(row.editor_id)
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    members.push({
      id: row.editor_id,
      name: profile?.name ?? 'Unknown',
      email: profile?.email ?? '',
      avatar_color: profile?.avatar_color ?? '#4CAF7D',
    })
  }

  data.owner = ownerProfile ?? null
  data.members = members

  return NextResponse.json({ project: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('workspace_id')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const authorized = project.workspace_id
    ? await hasWorkspaceRole(project.workspace_id, user.id, 'admin')
    : false

  if (!authorized) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const field of ['name', 'client', 'emoji'] as const) {
    if (field in body) updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('workspace_id')
    .eq('id', params.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const authorized = project.workspace_id
    ? await hasWorkspaceRole(project.workspace_id, user.id, 'admin')
    : false

  if (!authorized) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { error } = await supabaseAdmin
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}