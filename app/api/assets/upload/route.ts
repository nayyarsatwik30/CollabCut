import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { video } from '@/lib/mux'

export async function POST(req: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { project_id, name, version } = await req.json()
  if (!project_id || !name) return NextResponse.json({ error: 'project_id and name required' }, { status: 400 })

  const upload = await video.uploads.create({
    cors_origin: process.env.NEXT_PUBLIC_APP_URL!,
    new_asset_settings: {
      playback_policy: ['public'],
      mp4_support: 'capped-1080p',
    },
  })

  const { data: asset, error } = await supabaseAdmin
    .from('assets')
    .insert({
      project_id,
      uploaded_by: user.id,
      name,
      version: version ?? 1,
      status: 'processing',
      mux_upload_id: upload.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ asset, upload_url: upload.url, upload_id: upload.id }, { status: 201 })
}