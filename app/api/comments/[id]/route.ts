import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, hasWorkspaceRole, isAssignedEditor } from '@/lib/api-auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { data: comment } = await supabaseAdmin
    .from('comments')
    .select('asset_id')
    .eq('id', params.id)
    .single()

  if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

  const { data: asset } = await supabaseAdmin
    .from('assets')
    .select('projects(workspace_id)')
    .eq('id', comment.asset_id)
    .single()

  const workspaceId = asset?.projects
    ? (Array.isArray(asset.projects) ? asset.projects[0]?.workspace_id : (asset.projects as any).workspace_id)
    : null

  const isAdmin = workspaceId ? await hasWorkspaceRole(workspaceId, user.id, 'admin') : false
  const authorized = isAdmin || await isAssignedEditor(comment.asset_id, user.id)

  if (!authorized) return NextResponse.json({ error: 'Not authorized to update this comment' }, { status: 403 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const field of ['resolved', 'status'] as const) {
    if (field in body) updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { data: comment } = await supabaseAdmin
    .from('comments')
    .select('author_id, asset_id')
    .eq('id', params.id)
    .single()

  if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

  let authorized = comment.author_id === user.id

  if (!authorized) {
    const { data: asset } = await supabaseAdmin
      .from('assets')
      .select('projects(workspace_id)')
      .eq('id', comment.asset_id)
      .single()

    const workspaceId = asset?.projects
      ? (Array.isArray(asset.projects) ? asset.projects[0]?.workspace_id : (asset.projects as any).workspace_id)
      : null

    authorized = workspaceId ? await hasWorkspaceRole(workspaceId, user.id, 'admin') : false
  }

  if (!authorized) return NextResponse.json({ error: 'Not authorized to delete this comment' }, { status: 403 })

  const { error } = await supabaseAdmin
    .from('comments')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}