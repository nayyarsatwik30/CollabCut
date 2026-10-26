import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth, hasWorkspaceRole, isAssignedEditor } from '@/lib/api-auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const auth = await requireAuth(req)
    if ('error' in auth) return auth.error
    const { user } = auth

    const assetResult = await migrationDb.query(
        `SELECT p.workspace_id FROM assets a LEFT JOIN projects p ON p.id = a.project_id WHERE a.id = $1`,
        [params.id]
    )
    const asset = assetResult.rows[0]

    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const workspaceId = asset.workspace_id ?? null

    const isAdmin = workspaceId ? await hasWorkspaceRole(workspaceId, user.id, 'admin') : false
    const authorized = isAdmin || await isAssignedEditor(params.id, user.id)

    if (!authorized) return NextResponse.json({ error: 'Not authorized to delete this asset' }, { status: 403 })

    // ?scope=version is the version-switcher's delete: it removes this one row
    // and must leave the lineage with at least one live version, and must not
    // orphan the origin version that carries the Content Brief. Without it
    // this is the card-level delete, which may remove the last row.
    if (new URL(req.url).searchParams.get('scope') === 'version') {
        const { rows: lineage } = await migrationDb.query(
            `SELECT id, version, deleted_at FROM assets
             WHERE asset_group_id = (SELECT asset_group_id FROM assets WHERE id = $1)
             ORDER BY version ASC`,
            [params.id]
        )
        const target = lineage.find((r) => r.id === params.id)
        if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        if (target.deleted_at) return NextResponse.json({ success: true })

        const others = lineage.filter((r) => r.id !== params.id && !r.deleted_at)
        if (others.length === 0) {
            return NextResponse.json({ error: 'This is the only version left. Delete the whole cut instead.' }, { status: 409 })
        }
        if (lineage[0].id === params.id) {
            return NextResponse.json({ error: 'The original version holds the content brief and can\'t be deleted while later versions exist.' }, { status: 409 })
        }

        // Re-check "another live version exists" inside the UPDATE itself so two
        // concurrent version deletes can't both pass the check above.
        const result = await migrationDb.query(
            `UPDATE assets SET deleted_at = $1
             WHERE id = $2 AND deleted_at IS NULL
               AND EXISTS (SELECT 1 FROM assets o WHERE o.asset_group_id = assets.asset_group_id AND o.id <> assets.id AND o.deleted_at IS NULL)`,
            [new Date().toISOString(), params.id]
        )
        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'This is the only version left. Delete the whole cut instead.' }, { status: 409 })
        }
        return NextResponse.json({ success: true })
    }

    await migrationDb.query(`UPDATE assets SET deleted_at = $1 WHERE id = $2`, [new Date().toISOString(), params.id])

    return NextResponse.json({ success: true })
}