import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { latestPerGroup } from '@/lib/asset-lineage'

interface BoardAsset {
  id: string
  name: string
  pipeline_status: string
  is_complete: boolean
  project_id: string
  project_name: string
  editor: { id: string; name: string } | null
  mux_upload_id: string | null
}

function pickEditor(assetEditors: any): { id: string; name: string } | null {
  const rows = Array.isArray(assetEditors) ? assetEditors : assetEditors ? [assetEditors] : []
  const row = rows[0]
  if (!row) return null
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  return { id: row.editor_id, name: profile?.name ?? 'Unknown' }
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)

  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 })

  const membership = (memberships ?? []).find((m) => m.role === 'admin')
    ?? (memberships ?? []).find((m) => m.role === 'editor')

  if (!membership) return NextResponse.json({ error: 'No workspace access' }, { status: 403 })

  const role = membership.role as 'admin' | 'editor'
  const workspaceId = membership.workspace_id as string

  console.log('[api/board] user', user.id, 'role', role, 'workspaceId', workspaceId)

  let assets: BoardAsset[] = []

  if (role === 'admin') {
    const { data, error } = await supabaseAdmin
      .from('assets')
      .select('id, name, version, asset_group_id, pipeline_status, is_complete, project_id, mux_upload_id, projects!inner(id, name, workspace_id, deleted_at), asset_editors(editor_id, profiles(name, email))')
      .eq('projects.workspace_id', workspaceId)
      .eq('cut_type', 'board')
      .is('deleted_at', null)

    console.log('[api/board] admin raw query result (pre-filter):', JSON.stringify(data), 'error:', error?.message ?? null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    assets = latestPerGroup(
      (data ?? []).filter((row: any) => {
        const project = Array.isArray(row.projects) ? row.projects[0] : row.projects
        return project && !project.deleted_at
      })
    )
      .map((row: any) => {
        const project = Array.isArray(row.projects) ? row.projects[0] : row.projects
        return {
          id: row.id,
          name: row.name,
          pipeline_status: row.pipeline_status ?? 'idea',
          is_complete: row.is_complete,
          project_id: row.project_id,
          project_name: project?.name ?? 'Untitled project',
          editor: pickEditor(row.asset_editors),
          mux_upload_id: row.mux_upload_id ?? null,
        }
      })
  } else {
    const { data: myProfile } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle()

    // asset_editors pins an assignment to one specific version's row, not the
    // whole lineage - resolve which asset_group_id(s) this editor is assigned
    // to first (auth check), then pull every version in those groups so
    // latestPerGroup has the sibling versions to actually pick a latest from.
    // It can't promote a version it was never given.
    const { data: assignedRows, error: assignedError } = await supabaseAdmin
      .from('asset_editors')
      .select('assets!inner(asset_group_id, cut_type, deleted_at, projects!inner(workspace_id, deleted_at))')
      .eq('editor_id', user.id)
      .eq('assets.cut_type', 'board')

    if (assignedError) return NextResponse.json({ error: assignedError.message }, { status: 500 })

    const assignedGroupIds = Array.from(new Set(
      (assignedRows ?? [])
        .map((row: any) => (Array.isArray(row.assets) ? row.assets[0] : row.assets))
        .filter((asset: any) => {
          if (!asset || asset.deleted_at) return false
          const project = Array.isArray(asset.projects) ? asset.projects[0] : asset.projects
          return project && !project.deleted_at && project.workspace_id === workspaceId
        })
        .map((asset: any) => asset.asset_group_id)
    ))

    if (assignedGroupIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('assets')
        .select('id, name, version, asset_group_id, pipeline_status, is_complete, project_id, mux_upload_id, projects!inner(id, name, workspace_id, deleted_at)')
        .in('asset_group_id', assignedGroupIds)
        .is('deleted_at', null)

      console.log('[api/board] editor raw query result (pre-filter):', JSON.stringify(data), 'error:', error?.message ?? null)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      assets = latestPerGroup(
        (data ?? []).filter((row: any) => {
          const project = Array.isArray(row.projects) ? row.projects[0] : row.projects
          return project && !project.deleted_at
        })
      )
        .map((row: any) => {
          const project = Array.isArray(row.projects) ? row.projects[0] : row.projects
          return {
            id: row.id,
            name: row.name,
            pipeline_status: row.pipeline_status ?? 'idea',
            is_complete: row.is_complete,
            project_id: row.project_id,
            project_name: project?.name ?? 'Untitled project',
            editor: { id: user.id, name: myProfile?.name ?? user.email ?? 'You' },
            mux_upload_id: row.mux_upload_id ?? null,
          }
        })
    }
  }

  console.log('[api/board] final assets after filtering:', assets.length)

  return NextResponse.json({ role, workspace_id: workspaceId, assets })
}
