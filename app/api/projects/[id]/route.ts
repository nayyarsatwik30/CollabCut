import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'
import { latestPerGroup } from '@/lib/asset-lineage'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const projectResult = await migrationDb.query(`SELECT * FROM projects WHERE id = $1`, [params.id])
  const data = projectResult.rows[0]

  if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // A project with no workspace can't rely on the admin-membership check
  // below, it has to be excluded up front instead.
  let authorized = false
  let viewerIsAdmin = false

  if (data.workspace_id) {
    viewerIsAdmin = await hasWorkspaceRole(data.workspace_id, user.id, 'admin')
    authorized = viewerIsAdmin
  }

  if (!authorized) {
    const assignmentResult = await migrationDb.query(
      `SELECT ae.id FROM asset_editors ae
       JOIN assets a ON a.id = ae.asset_id
       WHERE ae.editor_id = $1 AND a.project_id = $2
       LIMIT 1`,
      [user.id, params.id]
    )
    authorized = assignmentResult.rows.length > 0
  }

  if (!authorized) return NextResponse.json({ error: 'Not authorized to view this project' }, { status: 403 })

  const assetsResult = await migrationDb.query(
    `SELECT id, name, version, asset_group_id, duration_sec, size_bytes, status, mux_playback_id, mux_upload_id, is_complete, cut_type
     FROM assets WHERE project_id = $1 AND deleted_at IS NULL`,
    [params.id]
  )
  data.assets = latestPerGroup(assetsResult.rows)

  const [ownerResult, editorRowsResult] = await Promise.all([
    migrationDb.query(
      `SELECT id, name, email, avatar_color FROM profiles WHERE id = $1`,
      [data.owner_id]
    ),
    // Members = editors actually assigned to an asset in this project, per
    // asset_editors - there's no separate project-membership table for this.
    migrationDb.query(
      `SELECT ae.editor_id, p.name, p.email, p.avatar_color
       FROM asset_editors ae
       JOIN assets a ON a.id = ae.asset_id
       JOIN profiles p ON p.id = ae.editor_id
       WHERE a.project_id = $1 AND a.deleted_at IS NULL`,
      [params.id]
    ),
  ])

  const seenEditors = new Set<string>()
  const members = []
  for (const row of editorRowsResult.rows) {
    if (seenEditors.has(row.editor_id)) continue
    seenEditors.add(row.editor_id)
    members.push({
      id: row.editor_id,
      name: row.name ?? 'Unknown',
      email: row.email ?? '',
      avatar_color: row.avatar_color ?? '#4CAF7D',
    })
  }

  data.owner = ownerResult.rows[0] ?? null
  data.members = members
  data.viewer_is_admin = viewerIsAdmin

  return NextResponse.json({ project: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const projectResult = await migrationDb.query(
    `SELECT workspace_id FROM projects WHERE id = $1`,
    [params.id]
  )
  const project = projectResult.rows[0]

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const authorized = project.workspace_id
    ? await hasWorkspaceRole(project.workspace_id, user.id, 'admin')
    : false

  if (!authorized) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const field of ['name', 'client', 'emoji'] as const) {
    if (field in body) updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const fields = Object.keys(updates)
  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ')
  const values = fields.map((field) => updates[field])

  const result = await migrationDb.query(
    `UPDATE projects SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
    [...values, params.id]
  )

  return NextResponse.json({ project: result.rows[0] })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const projectResult = await migrationDb.query(
    `SELECT workspace_id FROM projects WHERE id = $1`,
    [params.id]
  )
  const project = projectResult.rows[0]

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const authorized = project.workspace_id
    ? await hasWorkspaceRole(project.workspace_id, user.id, 'admin')
    : false

  if (!authorized) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  await migrationDb.query(`UPDATE projects SET deleted_at = now() WHERE id = $1`, [params.id])

  return NextResponse.json({ success: true })
}