import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
    const auth = await requireAuth(req)
    if ('error' in auth) return auth.error
    const { user } = auth

    // Get all projects owned by this user
    const { data: projects } = await supabaseAdmin
        .from('projects')
        .select('id, name')
        .eq('owner_id', user.id)

    const projectIds = (projects ?? []).map((p) => p.id)
    const projectMap = Object.fromEntries((projects ?? []).map((p) => [p.id, p.name]))

    if (projectIds.length === 0) {
        return NextResponse.json({ highlights: [] })
    }

    // Get assets in those projects
    const { data: assets } = await supabaseAdmin
        .from('assets')
        .select('id, name, project_id, status')
        .in('project_id', projectIds)

    const assetIds = (assets ?? []).map((a) => a.id)
    const assetMap = Object.fromEntries(
        (assets ?? []).map((a) => [a.id, { name: a.name, project_id: a.project_id, status: a.status }])
    )

    if (assetIds.length === 0) {
        return NextResponse.json({ highlights: [] })
    }

    // Get recent comments on those assets
    const { data: comments, error } = await supabaseAdmin
        .from('comments')
        .select('id, asset_id, time_sec, author_name, status, text, created_at')
        .in('asset_id', assetIds)
        .order('created_at', { ascending: false })
        .limit(30)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const highlights = (comments ?? []).map((c) => {
        const asset = assetMap[c.asset_id]
        return {
            id: c.id,
            asset_id: c.asset_id,
            asset_name: asset?.name ?? 'Unknown',
            project_name: asset ? projectMap[asset.project_id] ?? 'Unknown' : 'Unknown',
            time_sec: c.time_sec,
            author_name: c.author_name,
            status: c.status,
            text: c.text,
            created_at: c.created_at,
        }
    })

    return NextResponse.json({ highlights })
}