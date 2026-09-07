import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, raw_file_url, notes, reference, deadline } = await req.json()
  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'Title required' }, { status: 400 })
  }

  // Same workspace_members lookup used in GET /api/board and POST /api/projects,
  // narrowed to strictly 'admin' since creating New Content is admin-only.
  const { data: memberships } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)

  const adminMembership = (memberships ?? []).find((m) => m.role === 'admin')
  if (!adminMembership) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // New Content always creates a brand new project - Title becomes the
  // project name - and a placeholder asset inside it with no file yet.
  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .insert({
      name: title.trim(),
      client: '',
      emoji: '🎬',
      owner_id: user.id,
      workspace_id: adminMembership.workspace_id,
    })
    .select()
    .single()

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })

  const newAssetId = randomUUID()

  const { data: asset, error: assetError } = await supabaseAdmin
    .from('assets')
    .insert({
      id: newAssetId,
      project_id: project.id,
      uploaded_by: user.id,
      name: title.trim(),
      cut_type: 'board',
      pipeline_status: 'idea',
      raw_file_url: raw_file_url || null,
      notes: notes || null,
      reference: reference || null,
      deadline: deadline || null,
      asset_group_id: newAssetId,
    })
    .select()
    .single()

  if (assetError) return NextResponse.json({ error: assetError.message }, { status: 500 })

  return NextResponse.json({ project, asset }, { status: 201 })
}
