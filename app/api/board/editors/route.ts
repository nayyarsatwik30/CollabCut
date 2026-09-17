import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 })
  if (!membership) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { data: editorRows, error: editorsError } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id, profiles(name, email)')
    .eq('workspace_id', membership.workspace_id)
    .eq('role', 'editor')

  if (editorsError) return NextResponse.json({ error: editorsError.message }, { status: 500 })

  const editorIds = (editorRows ?? []).map((row) => row.user_id)

  const assetCountByEditor = new Map<string, number>()
  if (editorIds.length > 0) {
    const { data: assignmentRows, error: assignmentError } = await supabaseAdmin
      .from('asset_editors')
      .select('editor_id')
      .in('editor_id', editorIds)

    if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 })

    for (const row of assignmentRows ?? []) {
      assetCountByEditor.set(row.editor_id, (assetCountByEditor.get(row.editor_id) ?? 0) + 1)
    }
  }

  const editors = (editorRows ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      id: row.user_id,
      name: profile?.name ?? 'Unknown',
      email: profile?.email ?? '',
      assetCount: assetCountByEditor.get(row.user_id) ?? 0,
    }
  })

  return NextResponse.json({ workspace_id: membership.workspace_id, editors })
}
