import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createNotification } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  const asset_id = new URL(req.url).searchParams.get('asset_id')
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('comments')
    .select('*, replies(*)')
    .eq('asset_id', asset_id)
    .order('time_sec', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const { data: { user } } = token
    ? await supabaseAdmin.auth.getUser(token)
    : { data: { user: null } }

  const { asset_id, time_sec, text, status, author_name } = await req.json()

  if (!asset_id || time_sec === undefined || !text) {
    return NextResponse.json({ error: 'asset_id, time_sec and text required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      asset_id,
      time_sec,
      text,
      status: status ?? 'open',
      author_id: user?.id ?? null,
      author_name: author_name ?? 'Anonymous',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trigger 3: only when the commenter is an admin (not the assigned editor
  // commenting on their own upload), and only if someone is actually
  // assigned to notify. Best-effort - the comment itself already succeeded.
  if (user?.id) {
    const { data: assetRow } = await supabaseAdmin
      .from('assets')
      .select('projects(name, workspace_id)')
      .eq('id', asset_id)
      .maybeSingle()
    const project = assetRow?.projects
      ? (Array.isArray(assetRow.projects) ? assetRow.projects[0] : assetRow.projects)
      : null

    if (project?.workspace_id) {
      const { data: membership } = await supabaseAdmin
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', project.workspace_id)
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle()

      if (membership) {
        const { data: assignment } = await supabaseAdmin
          .from('asset_editors')
          .select('editor_id')
          .eq('asset_id', asset_id)
          .maybeSingle()

        if (assignment?.editor_id) {
          await createNotification({
            userId: assignment.editor_id,
            type: 'comment_added',
            message: `New comment on ${project.name ?? 'Untitled project'}`,
            link: `/review/${asset_id}`,
            assetId: asset_id,
          })
        }
      }
    }
  }

  return NextResponse.json({ comment: data }, { status: 201 })
}