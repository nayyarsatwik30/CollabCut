import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { asset_id, downloads_disabled, comments_only, expires_at } = await req.json()
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('share_links')
    .insert({
      asset_id,
      created_by: user.id,
      downloads_disabled: downloads_disabled ?? false,
      comments_only: comments_only ?? false,
      expires_at: expires_at ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/r/${data.token}`
  return NextResponse.json({ share_link: data, url }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('share_links')
    .select('*, assets(*)')
    .eq('token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }

  return NextResponse.json({ share_link: data })
}