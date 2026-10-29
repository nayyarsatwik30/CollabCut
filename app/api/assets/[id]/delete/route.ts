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

    // ?scope=group is the card-level delete: it removes every live version in
    // this asset's lineage. Each row gets its own deleted_at, so every version
    // lands in the Recycle Bin individually and is restorable on its own.
    if (new URL(req.url).searchParams.get('scope') === 'group') {
        await migrationDb.query(
            `UPDATE assets SET deleted_at = $2
             WHERE deleted_at IS NULL
               AND (id = $1 OR asset_group_id = (SELECT asset_group_id FROM assets WHERE id = $1))`,
            [params.id, new Date().toISOString()]
        )
        return NextResponse.json({ success: true })
    }

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
        //
        // asset_editors pins an assignment to one version's row, and the board
        // only counts assignments on live rows, so deleting an assigned version
        // would silently cut the editor off from the whole lineage. Hand its
        // assignments to the latest surviving version in the same statement
        // (data-modifying CTEs are atomic). Editors already assigned to that
        // version keep their existing row; their duplicate stays on the deleted one.
        const result = await migrationDb.query(
            `WITH del AS (
               UPDATE assets SET deleted_at = $1
               WHERE id = $2 AND deleted_at IS NULL
                 AND EXISTS (SELECT 1 FROM assets o WHERE o.asset_group_id = assets.asset_group_id AND o.id <> assets.id AND o.deleted_at IS NULL)
               RETURNING id, asset_group_id
             ),
             survivor AS (
               SELECT a.id FROM assets a, del
               WHERE a.asset_group_id = del.asset_group_id AND a.id <> del.id AND a.deleted_at IS NULL
               ORDER BY a.version DESC
               LIMIT 1
             ),
             moved AS (
               UPDATE asset_editors ae SET asset_id = (SELECT id FROM survivor)
               FROM del
               WHERE ae.asset_id = del.id
                 AND NOT EXISTS (
                   SELECT 1 FROM asset_editors x
                   WHERE x.asset_id = (SELECT id FROM survivor) AND x.editor_id = ae.editor_id
                 )
               RETURNING ae.id
             )
             SELECT id FROM del`,
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