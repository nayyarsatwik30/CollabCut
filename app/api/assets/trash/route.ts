import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, hasWorkspaceRole, isAssignedEditor } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { data: adminMemberships } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')

  const adminWorkspaceIds = (adminMemberships ?? []).map((m) => m.workspace_id)

  const { data: assignedRows } = await supabaseAdmin
    .from('asset_editors')
    .select('asset_id')
    .eq('editor_id', user.id)

  const assignedAssetIds = (assignedRows ?? []).map((r) => r.asset_id)

  // Merge two scopes - workspace-admin and assigned-editor - the same OR
  // that /api/assets/[id]/delete checks per-asset, applied in bulk here.
  const results = new Map<string, any>()

  if (adminWorkspaceIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('assets')
      .select('id, name, project_id, deleted_at, projects!inner(name, workspace_id)')
      .not('deleted_at', 'is', null)
      .in('projects.workspace_id', adminWorkspaceIds)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const row of data ?? []) results.set(row.id, row)
  }

  if (assignedAssetIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('assets')
      .select('id, name, project_id, deleted_at, projects(name, workspace_id)')
      .not('deleted_at', 'is', null)
      .in('id', assignedAssetIds)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const row of data ?? []) results.set(row.id, row)
  }

  const assets = Array.from(results.values())
    .map((row) => {
      const project = Array.isArray(row.projects) ? row.projects[0] : row.projects
      return {
        id: row.id,
        name: row.name,
        project_id: row.project_id,
        project_name: project?.name ?? 'Untitled project',
        deleted_at: row.deleted_at,
      }
    })
    .sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime())

  return NextResponse.json({ assets })
}

// Same authorization the delete endpoint itself uses - workspace admin OR
// assigned editor - so anyone who could delete an asset can also restore
// or permanently delete it from the Recycle Bin.
async function authorizeAsset(assetId: string, userId: string) {
  const { data: asset } = await supabaseAdmin
    .from('assets')
    .select('projects(workspace_id)')
    .eq('id', assetId)
    .single()

  if (!asset) return { ok: false as const, status: 404, message: 'Asset not found' }

  const workspaceId = asset.projects
    ? (Array.isArray(asset.projects) ? asset.projects[0]?.workspace_id : (asset.projects as any).workspace_id)
    : null

  const isAdmin = workspaceId ? await hasWorkspaceRole(workspaceId, userId, 'admin') : false
  const authorized = isAdmin || await isAssignedEditor(assetId, userId)

  if (!authorized) return { ok: false as const, status: 403, message: 'Not authorized to manage this asset' }
  return { ok: true as const }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  // Restore a soft-deleted asset
  const { asset_id } = await req.json()
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const check = await authorizeAsset(asset_id, user.id)
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status })

  const { error } = await supabaseAdmin
    .from('assets')
    .update({ deleted_at: null })
    .eq('id', asset_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  // Permanently delete
  const { searchParams } = new URL(req.url)
  const asset_id = searchParams.get('asset_id')
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const check = await authorizeAsset(asset_id, user.id)
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status })

  const { error } = await supabaseAdmin
    .from('assets')
    .delete()
    .eq('id', asset_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
