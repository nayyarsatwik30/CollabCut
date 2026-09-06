import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const PIPELINE_STATUSES = ['idea', 'scripting', 'filming', 'editing', 'review', 'revision', 'approved']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pipeline_status } = await req.json()
  if (!PIPELINE_STATUSES.includes(pipeline_status)) {
    return NextResponse.json({ error: 'Invalid pipeline_status' }, { status: 400 })
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

  const isApproved = pipeline_status === 'approved'

  const { data, error } = await supabaseAdmin
    .from('assets')
    .update({
      pipeline_status,
      is_complete: isApproved,
      marked_complete_by: isApproved ? user.id : null,
      marked_complete_at: isApproved ? new Date().toISOString() : null,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ asset: data })
}
