import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { complete } = await req.json()
  if (typeof complete !== 'boolean') {
    return NextResponse.json({ error: 'complete (boolean) required' }, { status: 400 })
  }

  const { data: assignment } = await supabaseAdmin
    .from('asset_editors')
    .select('id')
    .eq('asset_id', params.id)
    .eq('editor_id', user.id)
    .maybeSingle()

  let authorized = !!assignment

  if (!authorized) {
    const { data: asset } = await supabaseAdmin
      .from('assets')
      .select('project_id, projects(workspace_id)')
      .eq('id', params.id)
      .single()

    const workspaceId = asset?.projects
      ? (Array.isArray(asset.projects) ? asset.projects[0]?.workspace_id : (asset.projects as any).workspace_id)
      : null

    if (workspaceId) {
      const { data: membership } = await supabaseAdmin
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle()

      authorized = !!membership
    }
  }

  if (!authorized) return NextResponse.json({ error: 'Not authorized to update this asset' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('assets')
    .update({
      is_complete: complete,
      marked_complete_by: complete ? user.id : null,
      marked_complete_at: complete ? new Date().toISOString() : null,
      // Keep the Kanban board's pipeline_status in lockstep with is_complete
      // so a card only ever sits in the Approved column while is_complete
      // is true - un-marking complete here has to move it back out, or the
      // board and the review screen would read as out of sync again.
      pipeline_status: complete ? 'approved' : 'review',
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ asset: data })
}
