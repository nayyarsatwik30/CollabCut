import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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
