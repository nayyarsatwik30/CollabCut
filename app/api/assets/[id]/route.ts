import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, hasWorkspaceRole, isAssignedEditor } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { data: assetMeta } = await supabaseAdmin
    .from('assets')
    .select('projects(workspace_id)')
    .eq('id', params.id)
    .single()

  if (!assetMeta) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const workspaceId = assetMeta.projects
    ? (Array.isArray(assetMeta.projects) ? assetMeta.projects[0]?.workspace_id : (assetMeta.projects as any).workspace_id)
    : null

  const isAdmin = workspaceId ? await hasWorkspaceRole(workspaceId, user.id, 'admin') : false
  const authorized = isAdmin || await isAssignedEditor(params.id, user.id)

  if (!authorized) return NextResponse.json({ error: 'Not authorized to view this asset' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('assets')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Content Brief (raw_file_url/notes/reference/deadline) is only ever set on
  // the original New Content placeholder row, not on later versions - it's a
  // property of the lineage as a whole, so always resolve it from the
  // earliest version in the asset_group_id group (same grouping the
  // version-history endpoint uses) regardless of which version is being
  // viewed here.
  if (data.asset_group_id) {
    const { data: origin } = await supabaseAdmin
      .from('assets')
      .select('raw_file_url, notes, reference, deadline')
      .eq('asset_group_id', data.asset_group_id)
      .order('version', { ascending: true })
      .limit(1)
      .single()

    if (origin) {
      data.raw_file_url = origin.raw_file_url
      data.notes = origin.notes
      data.reference = origin.reference
      data.deadline = origin.deadline
    }
  }

  return NextResponse.json({ asset: data })
}