import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, data } = body

  if (type === 'video.asset.ready') {
    const muxAssetId   = data.id
    const playbackId   = data.playback_ids?.[0]?.id
    const durationSec  = data.duration

    await supabaseAdmin
      .from('assets')
      .update({
        mux_asset_id:    muxAssetId,
        mux_playback_id: playbackId,
        duration_sec:    durationSec,
        status:          'in_review',
      })
      .eq('mux_upload_id', data.upload_id)
  }

  if (type === 'video.asset.errored') {
    await supabaseAdmin
      .from('assets')
      .update({ status: 'processing' })
      .eq('mux_upload_id', data.upload_id)
  }

  return NextResponse.json({ received: true })
}