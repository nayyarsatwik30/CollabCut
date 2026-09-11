import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { syncProjectStatus } from '@/lib/project-status'
import { requireAuth, hasWorkspaceRole, isAssignedEditor } from '@/lib/api-auth'

const PIPELINE_STATUSES = ['idea', 'editing', 'review', 'revision', 'approved']
// Moving a card TO either of these is admin-only, regardless of which
// status it's currently in - an editor can still move OUT of them freely.
const RESTRICTED_TO_ADMIN = ['revision', 'approved']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { pipeline_status } = await req.json()
  if (!PIPELINE_STATUSES.includes(pipeline_status)) {
    return NextResponse.json({ error: 'Invalid pipeline_status' }, { status: 400 })
  }

  const { data: asset } = await supabaseAdmin
    .from('assets')
    .select('project_id, projects(workspace_id)')
    .eq('id', params.id)
    .single()

  const workspaceId = asset?.projects
    ? (Array.isArray(asset.projects) ? asset.projects[0]?.workspace_id : (asset.projects as any).workspace_id)
    : null

  const isAdmin = workspaceId ? await hasWorkspaceRole(workspaceId, user.id, 'admin') : false

  const authorized = isAdmin || await isAssignedEditor(params.id, user.id)
  if (!authorized) return NextResponse.json({ error: 'Not authorized to update this asset' }, { status: 403 })

  if (RESTRICTED_TO_ADMIN.includes(pipeline_status) && !isAdmin) {
    return NextResponse.json({ error: 'Admin access required to set this status' }, { status: 403 })
  }

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
  if (data.project_id) await syncProjectStatus(data.project_id)
  return NextResponse.json({ asset: data })
}
