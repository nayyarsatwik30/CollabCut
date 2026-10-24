import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { title, client, raw_file_url, notes, reference, deadline } = await req.json()
  if (!title || !title.trim()) {
    return NextResponse.json({ error: 'Title required' }, { status: 400 })
  }

  // Rendered as <a href> on the review page, so only http(s) may be stored -
  // a javascript: URL here would run in the viewer's session on click. Same
  // rule PATCH /api/projects/[id] applies to brief_drive_link.
  if (raw_file_url !== undefined && raw_file_url !== null && raw_file_url !== '') {
    if (typeof raw_file_url !== 'string' || !/^https?:\/\/\S+$/i.test(raw_file_url.trim())) {
      return NextResponse.json({ error: 'Raw footage link must start with http:// or https://' }, { status: 400 })
    }
  }

  // Same workspace_members lookup used in GET /api/board and POST /api/projects,
  // narrowed to strictly 'admin' since creating New Content is admin-only.
  const membershipsResult = await migrationDb.query(
    `SELECT workspace_id, role FROM workspace_members WHERE user_id = $1`,
    [user.id]
  )

  const adminMembership = membershipsResult.rows.find((m) => m.role === 'admin')
  if (!adminMembership) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // New Content always creates a brand new project - Title becomes the
  // project name - and a placeholder asset inside it with no file yet.
  const projectResult = await migrationDb.query(
    `INSERT INTO projects (name, client, emoji, owner_id, workspace_id)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [title.trim(), client?.trim() || '', '🎬', user.id, adminMembership.workspace_id]
  )
  const project = projectResult.rows[0]

  const newAssetId = randomUUID()

  const assetResult = await migrationDb.query(
    `INSERT INTO assets (id, project_id, uploaded_by, name, cut_type, pipeline_status, raw_file_url, notes, reference, deadline, asset_group_id)
     VALUES ($1,$2,$3,$4,'board','idea',$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      newAssetId,
      project.id,
      user.id,
      title.trim(),
      raw_file_url ? raw_file_url.trim() : null,
      notes || null,
      reference || null,
      deadline || null,
      newAssetId,
    ]
  )
  const asset = assetResult.rows[0]

  return NextResponse.json({ project, asset }, { status: 201 })
}
