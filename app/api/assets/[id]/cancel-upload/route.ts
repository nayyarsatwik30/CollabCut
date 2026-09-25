import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { video } from '@/lib/mux'
import { syncProjectStatus } from '@/lib/project-status'
import { requireAuth, canAccessAsset, verifyCancelToken } from '@/lib/api-auth'

// Cancels an in-flight direct upload: tells Mux to stop accepting the file and
// undoes the asset row /api/assets/upload created. Only valid until Mux has
// actually created its asset (the webhook sets mux_asset_id) - after that the
// file is transcoding and can no longer be cancelled.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  // Whether this upload filled a placeholder comes only from the token the
  // upload route signed - never from anything else in the request. Checked
  // before any lookup or write, so a bad token changes nothing.
  const { upload_id, cancel_token } = await req.json().catch(() => ({}))
  if (typeof upload_id !== 'string' || !upload_id) {
    return NextResponse.json({ error: 'upload_id required' }, { status: 400 })
  }
  const fulfilledPlaceholder = verifyCancelToken(cancel_token, params.id, upload_id)
  if (fulfilledPlaceholder === null) {
    return NextResponse.json({ error: 'Invalid cancel token' }, { status: 400 })
  }

  const assetResult = await migrationDb.query(
    `SELECT id, project_id, mux_upload_id, mux_asset_id FROM assets WHERE id = $1 AND deleted_at IS NULL`,
    [params.id]
  )
  const asset = assetResult.rows[0]
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!(await canAccessAsset(user.id, params.id))) {
    return NextResponse.json({ error: 'Not authorized to cancel this upload' }, { status: 403 })
  }

  // The upload must be the one this row is currently waiting on.
  if (asset.mux_upload_id !== upload_id) {
    return NextResponse.json({ error: 'Upload does not match this asset' }, { status: 409 })
  }
  if (asset.mux_asset_id) {
    return NextResponse.json({ error: 'Upload already finished and is being processed' }, { status: 409 })
  }

  // Best effort: an upload Mux has already completed or cancelled rejects the
  // call, which must not leave the row behind.
  try {
    await video.uploads.cancel(upload_id)
  } catch (err) {
    console.warn('Mux upload cancel failed:', err instanceof Error ? err.message : err)
  }

  if (fulfilledPlaceholder) {
    // Back to a pending placeholder - the row and its brief stay untouched.
    await migrationDb.query(
      `UPDATE assets SET status = 'processing', pipeline_status = 'idea', mux_upload_id = NULL, size_bytes = 0 WHERE id = $1`,
      [params.id]
    )
  } else {
    await migrationDb.query(`UPDATE assets SET deleted_at = $1 WHERE id = $2`, [new Date().toISOString(), params.id])
  }
  await syncProjectStatus(asset.project_id)

  return NextResponse.json({ success: true })
}
