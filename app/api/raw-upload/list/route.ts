import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const projectResult = await migrationDb.query(
    `SELECT workspace_id FROM projects WHERE id = $1`,
    [projectId]
  )
  const project = projectResult.rows[0]

  if (!project?.workspace_id) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const isAdmin = await hasWorkspaceRole(project.workspace_id, user.id, 'admin')
  if (!isAdmin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const rawFilesResult = await migrationDb.query(
    `SELECT id, file_name, file_size_bytes, content_type, created_at, uploaded_by
     FROM raw_files WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId]
  )
  const rawFiles = rawFilesResult.rows

  // raw_files.uploaded_by references profiles - fetched separately (rather
  // than a JOIN) to keep the same { ...file, profiles } shape the client
  // already reads.
  const uploaderIds = Array.from(new Set(rawFiles.map((f) => f.uploaded_by)))
  const profileRows = uploaderIds.length
    ? (await migrationDb.query(
        `SELECT id, name, email FROM profiles WHERE id = ANY($1)`,
        [uploaderIds]
      )).rows
    : []

  const profileById = new Map(profileRows.map((p) => [p.id, p]))

  const result = rawFiles.map((f) => ({
    ...f,
    profiles: profileById.get(f.uploaded_by) ?? null,
  }))

  return NextResponse.json({ rawFiles: result })
}
