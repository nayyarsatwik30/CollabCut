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
      `SELECT p.workspace_id FROM assets a LEFT JOIN projects p ON p.id = a.project_id WHERE a.id = $1`,
      [params.id]
    ),
  ])
  if ('error' in auth) return auth.error
  const { user } = auth

  const assetMeta = assetMetaResult.rows[0]
  if (!assetMeta) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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

  return NextResponse.json({ asset: data })
}