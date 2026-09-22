import { migrationDb } from '@/lib/migrationDb'
import { latestPerGroup } from '@/lib/asset-lineage'

// Recomputes a project's status from its assets' pipeline_status and writes
// it back, so projects.status (the dashboard badge) never has to be set
// directly by a single-asset action again.
export async function syncProjectStatus(projectId: string) {
  // Custom Cuts don't go through pipeline_status/review at all, so they're
  // excluded here - otherwise a project could never read as "approved"
  // while it still had an untouched Custom Cut sitting at the default status.
  const result = await migrationDb.query(
    `SELECT id, version, asset_group_id, pipeline_status FROM assets
     WHERE project_id = $1 AND cut_type = 'board' AND deleted_at IS NULL`,
    [projectId]
  )
  const assets = result.rows

  if (assets.length === 0) return

  const latest = latestPerGroup(assets)

  const status = latest.every((a) => a.pipeline_status === 'approved')
    ? 'approved'
    : latest.some((a) => a.pipeline_status === 'revision')
    ? 'changes'
    : 'in_review'

  await migrationDb.query(`UPDATE projects SET status = $1 WHERE id = $2`, [status, projectId])
}
