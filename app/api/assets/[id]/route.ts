import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth, hasWorkspaceRole, isAssignedEditor } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // requireAuth only needs the request's bearer token; this asset/workspace
  // lookup only needs params.id - neither depends on the other's result, so
  // run them concurrently instead of paying for both round trips in series.
  const [auth, assetMetaResult] = await Promise.all([
    requireAuth(req),
    migrationDb.query(
      `SELECT p.workspace_id, a.deleted_at, p.deleted_at AS project_deleted_at
       FROM assets a LEFT JOIN projects p ON p.id = a.project_id WHERE a.id = $1`,
      [params.id]
    ),
  ])
  if ('error' in auth) return auth.error
  const { user } = auth

  // A trashed asset, or any asset in a trashed project, is gone as far as
  // the review screen is concerned - old links and notifications shouldn't
  // still open it. The Trash page lists and restores through /api/assets/trash.
  const assetMeta = assetMetaResult.rows[0]
  if (!assetMeta || assetMeta.deleted_at || assetMeta.project_deleted_at) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const workspaceId = assetMeta.workspace_id ?? null

  const isAdmin = workspaceId ? await hasWorkspaceRole(workspaceId, user.id, 'admin') : false
  const authorized = isAdmin || await isAssignedEditor(params.id, user.id)

  if (!authorized) return NextResponse.json({ error: 'Not authorized to view this asset' }, { status: 403 })

  const dataResult = await migrationDb.query(`SELECT * FROM assets WHERE id = $1`, [params.id])
  const data = dataResult.rows[0]

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Content Brief (raw_file_url/notes/reference/deadline) is only ever set on
  // the original New Content placeholder row, not on later versions - it's a
  // property of the lineage as a whole, so always resolve it from the
  // earliest version in the asset_group_id group (same grouping the
  // version-history endpoint uses) regardless of which version is being
  // viewed here.
  if (data.asset_group_id) {
    const originResult = await migrationDb.query(
      `SELECT raw_file_url, notes, reference, deadline FROM assets
       WHERE asset_group_id = $1 ORDER BY version ASC LIMIT 1`,
      [data.asset_group_id]
    )
    const origin = originResult.rows[0]

    if (origin) {
      data.raw_file_url = origin.raw_file_url
      data.notes = origin.notes
      data.reference = origin.reference
      data.deadline = origin.deadline
    }
  }

  // Project brief: fallback for lineages with no brief of their own. Kept in a
  // separate best-effort query so this endpoint still works on a database
  // where migration-project-brief.sql hasn't been applied yet.
  data.project_brief = { notes: null, reference: null, deadline: null, drive_link: null }
  try {
    const briefResult = await migrationDb.query(
      `SELECT brief_notes, brief_reference, brief_deadline::text AS brief_deadline, brief_drive_link
       FROM projects WHERE id = $1`,
      [data.project_id]
    )
    const b = briefResult.rows[0]
    if (b) {
      data.project_brief = {
        notes: b.brief_notes,
        reference: b.brief_reference,
        deadline: b.brief_deadline,
        drive_link: b.brief_drive_link,
      }
    }
  } catch {
    // columns not migrated yet - treat as no project brief
  }

  return NextResponse.json({ asset: data })
}