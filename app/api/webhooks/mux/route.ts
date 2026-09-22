import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { mux } from '@/lib/mux'

export async function POST(req: NextRequest) {
  // Signature is computed over the exact raw bytes Mux sent - req.json()
  // would re-serialize and break verification, so read it as text first.
  const rawBody = await req.text()

  let event
  try {
    event = await mux.webhooks.unwrap(rawBody, req.headers)
  } catch (err) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  const { type, data } = event as any

  if (type === 'video.asset.ready') {
    const muxAssetId  = data.id
    const playbackId  = data.playback_ids?.[0]?.id
    const durationSec = data.duration

    // Only leave the "processing" state once a playback ID actually exists —
    // otherwise the review page would show a video player with no stream to
    // play, since mux_playback_id would stay null indefinitely.
    const updated = await migrationDb.query(
      `UPDATE assets
       SET mux_asset_id = $1,
           duration_sec = $2
           ${playbackId ? ", mux_playback_id = $3, status = 'in_review'" : ''}
       WHERE mux_upload_id = $${playbackId ? 4 : 3}
       RETURNING id, project_id`,
      playbackId
        ? [muxAssetId, durationSec, playbackId, data.upload_id]
        : [muxAssetId, durationSec, data.upload_id]
    )
    const updatedAsset = updated.rows[0]

    // First asset in this project to ever finish processing becomes the
    // permanent project-card cover, never overwritten again (see
    // lib/project-covers.ts). The IS NULL guard makes this a no-op once a
    // project already has a pin, safely even under concurrent webhooks.
    if (playbackId && updatedAsset) {
      await migrationDb.query(
        `UPDATE projects
         SET cover_asset_id = $1, cover_playback_id = $2
         WHERE id = $3 AND cover_asset_id IS NULL`,
        [updatedAsset.id, playbackId, updatedAsset.project_id]
      )
    }
  }

  if (type === 'video.asset.errored') {
    await migrationDb.query(
      `UPDATE assets SET status = 'processing' WHERE mux_upload_id = $1`,
      [data.upload_id]
    )
  }

  return NextResponse.json({ received: true })
}
