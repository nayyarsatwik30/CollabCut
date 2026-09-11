import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ projects: [] })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ projects: [] })

  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('owner_id', user.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const projectIds = (data ?? []).map((p) => p.id)
  const coverByProject: Record<string, string> = {}

  if (projectIds.length > 0) {
    // Most recently created Board Cut asset per project that actually has a
    // Mux thumbnail - mux_playback_id is only ever set once a real upload
    // finishes processing, so this already excludes placeholders and
    // still-processing assets without a separate check.
    const { data: coverAssets } = await supabaseAdmin
      .from('assets')
      .select('project_id, mux_playback_id')
      .in('project_id', projectIds)
      .eq('cut_type', 'board')
      .is('deleted_at', null)
      .not('mux_playback_id', 'is', null)
      .order('created_at', { ascending: false })

    for (const a of coverAssets ?? []) {
      if (!coverByProject[a.project_id]) coverByProject[a.project_id] = a.mux_playback_id
    }
  }

  const projects = (data ?? []).map((p) => ({
    ...p,
    cover_playback_id: coverByProject[p.id] ?? null,
  }))

  return NextResponse.json({ projects })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, client, emoji } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data: memberships } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)

  const membership = (memberships ?? []).find((m) => m.role === 'admin') ?? (memberships ?? [])[0]

  // A project with no workspace_id can never pass the workspace-membership
  // check in GET /api/projects/[id] or GET /api/board for anyone - reject
  // up front instead of silently creating an unreachable project.
  if (!membership) {
    return NextResponse.json({ error: 'You must belong to a workspace before creating a project' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({
      name,
      client,
      emoji: emoji ?? '🎬',
      owner_id: user.id,
      workspace_id: membership.workspace_id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ project: data }, { status: 201 })
}