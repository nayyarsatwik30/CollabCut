import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'

// Sums size_bytes across every asset (Custom Cut + Board Cut - cut_type
// isn't filtered, so both count) plus file_size_bytes across every raw
// footage upload.
//
// If the caller belongs to a workspace that's been assigned an agency plan
// tier (workspaces.workspace_plan_id), usage is pooled across every project
// in that workspace instead of scoped to their own uploads - agency tiers
// bill storage at the workspace level, not per editor. Anyone without a
// planned workspace gets their own uploads and plan_missing: true, so the
// bar says "No plan assigned" instead of inventing a cap. Read-only - never
// touches upload logic or the underlying columns.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const agencyResult = await migrationDb.query(
    `SELECT wm.workspace_id, wp.id AS plan_id, wp.name AS plan_name, wp.storage_gb, wp.max_admins, wp.max_editors
     FROM workspace_members wm
     JOIN workspaces w ON w.id = wm.workspace_id
     JOIN workspace_plans wp ON wp.id = w.workspace_plan_id
     WHERE wm.user_id = $1
     ORDER BY wp.sort_order DESC
     LIMIT 1`,
    [user.id]
  )
  const agencyMembership = agencyResult.rows[0]

  if (agencyMembership) {
    const projectsResult = await migrationDb.query(
      `SELECT id FROM projects WHERE workspace_id = $1`,
      [agencyMembership.workspace_id]
    )
    const projectIds = projectsResult.rows.map((p) => p.id)

    const [assetsResult, rawFilesResult] = await Promise.all([
      migrationDb.query(`SELECT COALESCE(SUM(size_bytes), 0) AS total FROM assets WHERE project_id = ANY($1)`, [projectIds]),
      migrationDb.query(`SELECT COALESCE(SUM(file_size_bytes), 0) AS total FROM raw_files WHERE project_id = ANY($1)`, [projectIds]),
    ])

    const assetsTotal = Number(assetsResult.rows[0].total)
    const rawFilesTotal = Number(rawFilesResult.rows[0].total)

    return NextResponse.json({
      used_bytes: assetsTotal + rawFilesTotal,
      workspace_plan: {
        id: agencyMembership.plan_id,
        name: agencyMembership.plan_name,
        storage_gb: agencyMembership.storage_gb,
        max_admins: agencyMembership.max_admins,
        max_editors: agencyMembership.max_editors,
      },
      plan_missing: false,
    })
  }

  const [assetsResult, rawFilesResult] = await Promise.all([
    migrationDb.query(`SELECT COALESCE(SUM(size_bytes), 0) AS total FROM assets WHERE uploaded_by = $1`, [user.id]),
    migrationDb.query(`SELECT COALESCE(SUM(file_size_bytes), 0) AS total FROM raw_files WHERE uploaded_by = $1`, [user.id]),
  ])

  const assetsTotal = Number(assetsResult.rows[0].total)
  const rawFilesTotal = Number(rawFilesResult.rows[0].total)

  return NextResponse.json({ used_bytes: assetsTotal + rawFilesTotal, workspace_plan: null, plan_missing: true })
}
