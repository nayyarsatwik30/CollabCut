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

    await migrationDb.query(`UPDATE assets SET deleted_at = $1 WHERE id = $2`, [new Date().toISOString(), params.id])

    return NextResponse.json({ success: true })
}