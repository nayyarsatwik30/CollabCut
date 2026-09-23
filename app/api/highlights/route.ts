import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
    const auth = await requireAuth(req)
    if ('error' in auth) return auth.error
    const { user } = auth

    // Assets this user can see activity on: everything in projects they own
    // (the admin case), plus every version in any asset lineage they're
    // assigned to as an editor. Editors own no projects, so scoping by
    // owner_id alone left their Recent tab permanently empty. Lineage-level
    // match mirrors isAssignedEditor - an assignment is pinned to one
    // version, but comments land on whichever version is current.
    const assetsResult = await migrationDb.query(
        `SELECT a.id, a.name, a.project_id, a.status, p.name AS project_name
         FROM assets a
         JOIN projects p ON p.id = a.project_id
         WHERE a.deleted_at IS NULL AND p.deleted_at IS NULL
           AND (p.owner_id = $1
            OR COALESCE(a.asset_group_id, a.id) IN (
                SELECT COALESCE(ea.asset_group_id, ea.id)
                FROM asset_editors ae
                JOIN assets ea ON ea.id = ae.asset_id
                WHERE ae.editor_id = $1
            ))`,
        [user.id]
    )
    const assets = assetsResult.rows
    const projectMap = Object.fromEntries(assets.map((a) => [a.project_id, a.project_name]))

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