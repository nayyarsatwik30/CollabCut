import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessAsset } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'
import { resolveAssetDownload } from '@/lib/download'

// Download for the signed-in review screen (admin, or editor on the asset's
// lineage). Same gate as GET /api/assets/[id]: trashed assets/projects are
// gone, and anyone outside the workspace gets 403.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const metaResult = await migrationDb.query(
    `SELECT a.deleted_at, p.deleted_at AS project_deleted_at
     FROM assets a LEFT JOIN projects p ON p.id = a.project_id WHERE a.id = $1`,
    [params.id]
  )
  const meta = metaResult.rows[0]
  if (!meta || meta.deleted_at || meta.project_deleted_at) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!(await canAccessAsset(auth.user.id, params.id))) {
    return NextResponse.json({ error: 'Not authorized to download this asset' }, { status: 403 })
  }

  const resolved = await resolveAssetDownload(params.id)
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status })

  return NextResponse.json({ url: resolved.url }, { headers: { 'Cache-Control': 'no-store' } })
}
