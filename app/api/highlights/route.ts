import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
    const auth = await requireAuth(req)
    if ('error' in auth) return auth.error
    const { user } = auth

    // Get all projects owned by this user
    const projectsResult = await migrationDb.query(
        `SELECT id, name FROM projects WHERE owner_id = $1 AND deleted_at IS NULL`,
        [user.id]
    )
    const projects = projectsResult.rows

    const projectIds = projects.map((p) => p.id)
    const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]))

    if (projectIds.length === 0) {
        return NextResponse.json({ highlights: [] })
    }

    // Get assets in those projects
    const assetsResult = await migrationDb.query(
        `SELECT id, name, project_id, status FROM assets WHERE project_id = ANY($1::uuid[]) AND deleted_at IS NULL`,
        [projectIds]
    )
    const assets = assetsResult.rows

    const assetIds = assets.map((a) => a.id)
    const assetMap = Object.fromEntries(
        assets.map((a) => [a.id, { name: a.name, project_id: a.project_id, status: a.status }])
    )

    if (assetIds.length === 0) {
        return NextResponse.json({ highlights: [] })
    }

    // Get recent comments on those assets
    const commentsResult = await migrationDb.query(
        `SELECT id, asset_id, time_sec, author_name, status, text, created_at
         FROM comments WHERE asset_id = ANY($1::uuid[])
         ORDER BY created_at DESC LIMIT 30`,
        [assetIds]
    )
    const comments = commentsResult.rows

    const highlights = comments.map((c) => {
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