import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
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
    const muxAssetId   = data.id
    const playbackId   = data.playback_ids?.[0]?.id
    const durationSec  = data.duration

    // Only leave the "processing" state once a playback ID actually exists —
    // otherwise the review page would show a video player with no stream to
    // play, since mux_playback_id would stay null indefinitely.
    const { data: updatedAsset } = await supabaseAdmin
      .from('assets')
      .update({
        mux_asset_id:    muxAssetId,
        ...(playbackId ? { mux_playback_id: playbackId, status: 'in_review', mux_ready_at: new Date().toISOString() } : {}),
        duration_sec:    durationSec,
      })
      .eq('mux_upload_id', data.upload_id)
      .select('id, project_id')
      .single()

    // First asset in this project to ever finish processing becomes the
    // permanent project-card cover, never overwritten again (see
    // lib/project-covers.ts). The IS NULL guard makes this a no-op once a
    // project already has a pin, safely even under concurrent webhooks.
    if (playbackId && updatedAsset) {
      await supabaseAdmin
        .from('projects')
        .update({ cover_asset_id: updatedAsset.id, cover_playback_id: playbackId })
        .eq('id', updatedAsset.project_id)
        .is('cover_asset_id', null)
    }
  }

  if (type === 'video.asset.errored') {
    await supabaseAdmin
      .from('assets')
      .update({ status: 'processing' })
      .eq('mux_upload_id', data.upload_id)
  }

  return NextResponse.json({ received: true })
}
