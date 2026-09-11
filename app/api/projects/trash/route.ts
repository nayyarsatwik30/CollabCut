import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('owner_id', user.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ projects: data ?? [] })
}

export async function POST(req: NextRequest) {
    const auth = await requireAuth(req)
    if ('error' in auth) return auth.error
    const { user } = auth

    // Restore a project
    const { project_id } = await req.json()
    if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

    const { data: project } = await supabaseAdmin
        .from('projects')
        .select('owner_id')
        .eq('id', project_id)
        .single()

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (project.owner_id !== user.id) {
        return NextResponse.json({ error: 'Not authorized to restore this project' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
        .from('projects')
        .update({ deleted_at: null })
        .eq('id', project_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
    const auth = await requireAuth(req)
    if ('error' in auth) return auth.error
    const { user } = auth

    // Permanently delete
    const { searchParams } = new URL(req.url)
    const project_id = searchParams.get('project_id')
    if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

    const { data: project } = await supabaseAdmin
        .from('projects')
        .select('owner_id')
        .eq('id', project_id)
        .single()

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (project.owner_id !== user.id) {
        return NextResponse.json({ error: 'Not authorized to delete this project' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
        .from('projects')
        .delete()
        .eq('id', project_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}