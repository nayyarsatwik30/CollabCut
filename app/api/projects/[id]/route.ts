import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*, assets(*)')
    .eq('id', params.id)
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
    const latestByGroup = new Map<string, any>()
    for (const asset of data.assets) {
      if (asset.deleted_at) continue
      const key = asset.asset_group_id ?? asset.id
      const existing = latestByGroup.get(key)
      if (!existing || asset.version > existing.version) {
        latestByGroup.set(key, asset)
      }
    }
    data.assets = Array.from(latestByGroup.values())
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
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('projects')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabaseAdmin
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}