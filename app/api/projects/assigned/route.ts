import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'
import { attachCoverPlaybackIds } from '@/lib/project-covers'

// Projects an editor can reach even with no workspace-admin role - a project
// counts as theirs if they hold at least one asset_editors assignment in it,
// same rule GET /api/projects/[id] already uses to authorize the page this
// list links into.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const result = await migrationDb.query(
    `SELECT p.*
     FROM projects p
     WHERE p.deleted_at IS NULL
       AND p.id IN (
         SELECT a.project_id
         FROM asset_editors ae
         JOIN assets a ON a.id = ae.asset_id
         WHERE ae.editor_id = $1 AND a.deleted_at IS NULL
       )
     ORDER BY p.updated_at DESC`,
    [user.id]
  )

  const projects = await attachCoverPlaybackIds(result.rows)
  return NextResponse.json({ projects })
}
