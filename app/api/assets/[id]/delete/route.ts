import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, hasWorkspaceRole, isAssignedEditor } from '@/lib/api-auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireAuth(req)
    if ('error' in auth) return auth.error
    const { user } = auth

    const { data: asset } = await supabaseAdmin
        .from('assets')
        .select('projects(workspace_id)')
        .eq('id', params.id)
        .single()

    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const workspaceId = asset.projects
        ? (Array.isArray(asset.projects) ? asset.projects[0]?.workspace_id : (asset.projects as any).workspace_id)
        : null

    const isAdmin = workspaceId ? await hasWorkspaceRole(workspaceId, user.id, 'admin') : false
    const authorized = isAdmin || await isAssignedEditor(params.id, user.id)

    if (!authorized) return NextResponse.json({ error: 'Not authorized to delete this asset' }, { status: 403 })

    const { error } = await supabaseAdmin
        .from('assets')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}