import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { syncProjectStatus } from '@/lib/project-status'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { complete } = await req.json()
  if (typeof complete !== 'boolean') {
    return NextResponse.json({ error: 'complete (boolean) required' }, { status: 400 })
  }

  // Approving a cut is admin-only - an assigned editor is never authorized
  // here, regardless of asset_editors assignment.
  const { data: asset } = await supabaseAdmin
    .from('assets')
    .select('project_id, projects(workspace_id)')
    .eq('id', params.id)
    .single()

  const workspaceId = asset?.projects
    ? (Array.isArray(asset.projects) ? asset.projects[0]?.workspace_id : (asset.projects as any).workspace_id)
    : null

  const authorized = workspaceId ? await hasWorkspaceRole(workspaceId, user.id, 'admin') : false

  if (!authorized) return NextResponse.json({ error: 'Admin access required to approve a cut' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('assets')
    .update({
      is_complete: complete,
      marked_complete_by: complete ? user.id : null,
      marked_complete_at: complete ? new Date().toISOString() : null,
      // Keep the Kanban board's pipeline_status and the review screen's own
      // status badge in lockstep with is_complete, so a card only ever sits
      // in the Approved column - and only ever shows as Approved on the
      // review page - while is_complete is true.
      pipeline_status: complete ? 'approved' : 'review',
      status: complete ? 'approved' : 'in_review',
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data.project_id) await syncProjectStatus(data.project_id)
  return NextResponse.json({ asset: data })
}
