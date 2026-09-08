import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { latestPerGroup } from '@/lib/asset-lineage'
import { createNotification } from '@/lib/notifications'

async function requireAdminWorkspace(token: string) {
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return { error: 'Unauthorized', status: 401 as const }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (membershipError) return { error: membershipError.message, status: 500 as const }
  if (!membership) return { error: 'Admin access required', status: 403 as const }

  return { workspaceId: membership.workspace_id as string }
}

async function verifyAssetInWorkspace(assetId: string, workspaceId: string) {
  const { data, error } = await supabaseAdmin
    .from('assets')
    .select('id, projects!inner(workspace_id)')
    .eq('id', assetId)
    .eq('projects.workspace_id', workspaceId)
    .maybeSingle()

  if (error) return false
  return !!data
}

// Admin-only lookup of one editor's assigned Board Cut assets, scoped to the
// admin's own workspace - same asset_editors -> assets -> projects join and
// per-lineage dedup GET /api/board uses for an editor's own view, just
// parameterized by an arbitrary editor id instead of the caller's own.
export async function GET(req: NextRequest, { params }: { params: { editorId: string } }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requireAdminWorkspace(token)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('name, email')
    .eq('id', params.editorId)
    .maybeSingle()

  // Same lineage-expansion fix as GET /api/board's editor branch: asset_editors
  // pins to one specific version's row, so resolve the assigned
  // asset_group_id(s) first (auth check), then pull every version in those
  // groups for latestPerGroup to pick the true latest from.
  const { data: assignedRows, error: assignedError } = await supabaseAdmin
    .from('asset_editors')
    .select('assets!inner(asset_group_id, cut_type, deleted_at, projects!inner(workspace_id, deleted_at))')
    .eq('editor_id', params.editorId)
    .eq('assets.cut_type', 'board')

  if (assignedError) return NextResponse.json({ error: assignedError.message }, { status: 500 })

  const assignedGroupIds = Array.from(new Set(
    (assignedRows ?? [])
      .map((row: any) => (Array.isArray(row.assets) ? row.assets[0] : row.assets))
      .filter((asset: any) => {
        if (!asset || asset.deleted_at) return false
        const project = Array.isArray(asset.projects) ? asset.projects[0] : asset.projects
        return project && !project.deleted_at && project.workspace_id === auth.workspaceId
      })
      .map((asset: any) => asset.asset_group_id)
  ))

  let assets: any[] = []

  if (assignedGroupIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('assets')
      .select('id, name, version, asset_group_id, pipeline_status, is_complete, project_id, mux_upload_id, projects!inner(id, name, workspace_id, deleted_at)')
      .in('asset_group_id', assignedGroupIds)
      .is('deleted_at', null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    assets = latestPerGroup(
      (data ?? []).filter((row: any) => {
        const project = Array.isArray(row.projects) ? row.projects[0] : row.projects
        return project && !project.deleted_at
      })
    ).map((row: any) => {
      const project = Array.isArray(row.projects) ? row.projects[0] : row.projects
      return {
        id: row.id,
        name: row.name,
        pipeline_status: row.pipeline_status ?? 'idea',
        is_complete: row.is_complete,
        project_id: row.project_id,
        project_name: project?.name ?? 'Untitled project',
        mux_upload_id: row.mux_upload_id ?? null,
      }
    })
  }

  return NextResponse.json({
    editor: { id: params.editorId, name: profile?.name ?? profile?.email ?? 'Unknown' },
    assets,
  })
}

export async function POST(req: NextRequest, { params }: { params: { editorId: string } }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requireAdminWorkspace(token)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { assetId } = await req.json()
  if (!assetId) return NextResponse.json({ error: 'assetId required' }, { status: 400 })

  const inWorkspace = await verifyAssetInWorkspace(assetId, auth.workspaceId)
  if (!inWorkspace) return NextResponse.json({ error: 'Asset not found in your workspace' }, { status: 404 })

  const { error } = await supabaseAdmin
    .from('asset_editors')
    .upsert({ asset_id: assetId, editor_id: params.editorId }, { onConflict: 'asset_id,editor_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trigger 1: notify the newly-assigned editor. Best-effort - the
  // assignment itself already succeeded above regardless of this.
  const { data: assetRow } = await supabaseAdmin
    .from('assets')
    .select('project_id, projects(name)')
    .eq('id', assetId)
    .maybeSingle()

  if (assetRow?.project_id) {
    const project = Array.isArray(assetRow.projects) ? assetRow.projects[0] : assetRow.projects
    await createNotification({
      userId: params.editorId,
      type: 'editor_assigned',
      message: `New project assigned: ${project?.name ?? 'Untitled project'}`,
      link: `/project/${assetRow.project_id}`,
      assetId,
    })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: { editorId: string } }) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requireAdminWorkspace(token)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { assetId } = await req.json()
  if (!assetId) return NextResponse.json({ error: 'assetId required' }, { status: 400 })

  const inWorkspace = await verifyAssetInWorkspace(assetId, auth.workspaceId)
  if (!inWorkspace) return NextResponse.json({ error: 'Asset not found in your workspace' }, { status: 404 })

  const { error } = await supabaseAdmin
    .from('asset_editors')
    .delete()
    .eq('asset_id', assetId)
    .eq('editor_id', params.editorId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
