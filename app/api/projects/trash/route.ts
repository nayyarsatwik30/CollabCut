import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
    const auth = await requireAuth(req)
    if ('error' in auth) return auth.error
    const { user } = auth

    const result = await migrationDb.query(
        `SELECT * FROM projects WHERE owner_id = $1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`,
        [user.id]
    )

    return NextResponse.json({ projects: result.rows })
}

export async function POST(req: NextRequest) {
    const auth = await requireAuth(req)
    if ('error' in auth) return auth.error
    const { user } = auth

    // Restore a project
    const { project_id } = await req.json()
    if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

    const projectResult = await migrationDb.query(
        `SELECT owner_id FROM projects WHERE id = $1`,
        [project_id]
    )
    const project = projectResult.rows[0]

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (project.owner_id !== user.id) {
        return NextResponse.json({ error: 'Not authorized to restore this project' }, { status: 403 })
    }

    await migrationDb.query(`UPDATE projects SET deleted_at = NULL WHERE id = $1`, [project_id])

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

    const projectResult = await migrationDb.query(
        `SELECT owner_id FROM projects WHERE id = $1`,
        [project_id]
    )
    const project = projectResult.rows[0]

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (project.owner_id !== user.id) {
        return NextResponse.json({ error: 'Not authorized to delete this project' }, { status: 403 })
    }

    await migrationDb.query(`DELETE FROM projects WHERE id = $1`, [project_id])

    return NextResponse.json({ success: true })
}