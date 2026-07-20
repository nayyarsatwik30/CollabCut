import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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
    // Restore a project
    const { project_id } = await req.json()
    const { error } = await supabaseAdmin
        .from('projects')
        .update({ deleted_at: null })
        .eq('id', project_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
    // Permanently delete
    const { searchParams } = new URL(req.url)
    const project_id = searchParams.get('project_id')
    if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

    const { error } = await supabaseAdmin
        .from('projects')
        .delete()
        .eq('id', project_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}