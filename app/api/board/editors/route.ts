import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const editors = await Promise.all(
    (editorRows ?? []).map(async (row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      const { count } = await supabaseAdmin
        .from('asset_editors')
        .select('id', { count: 'exact', head: true })
        .eq('editor_id', row.user_id)

      return {
        id: row.user_id,
        name: profile?.name ?? 'Unknown',
        email: profile?.email ?? '',
        assetCount: count ?? 0,
      }
    })
  )

  return NextResponse.json({ workspace_id: membership.workspace_id, editors })
}
