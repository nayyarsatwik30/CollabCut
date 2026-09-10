import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hashSharePassword } from '@/lib/share-password'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { asset_id, downloads_disabled, comments_only, expires_at, password } = await req.json()
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('share_links')
    .insert({
      asset_id,
      created_by: user.id,
      downloads_disabled: downloads_disabled ?? false,
      comments_only: comments_only ?? false,
      expires_at: expires_at ?? null,
      password_hash: password ? hashSharePassword(password) : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { password_hash, ...safeShareLink } = data
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/r/${data.token}`
  return NextResponse.json({ share_link: safeShareLink, url }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('share_links')
    .select('token, expires_at, downloads_disabled, comments_only, password_hash, assets(id, name, mux_playback_id, mux_upload_id, is_complete, deleted_at)')
    .eq('token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }

  const asset = Array.isArray(data.assets) ? data.assets[0] : data.assets
  if (!asset || asset.deleted_at) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  }

  // Public route (no auth) - never hand the password hash to the client,
  // and narrow the asset down from assets(*) so internal fields (notes,
  // deadline, raw_file_url) never reach an outside reviewer.
  return NextResponse.json({
    share_link: {
      token: data.token,
      expires_at: data.expires_at,
      downloads_disabled: data.downloads_disabled,
      comments_only: data.comments_only,
      password_protected: !!data.password_hash,
      asset: {
        id: asset.id,
        name: asset.name,
        mux_playback_id: asset.mux_playback_id,
        mux_upload_id: asset.mux_upload_id,
        is_complete: asset.is_complete,
      },
    },
  })
}