import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifySharePassword } from '@/lib/share-password'

// Public, unauthenticated - the /r/[token] page has no user JWT to send.
// Trust is rooted entirely in the share token (and its password, if set),
// re-verified here on every request rather than relying on the client
// having already passed the gate.
export async function POST(req: NextRequest) {
  const { token, time_sec, text, author_name, password } = await req.json()

  if (!token || time_sec === undefined || !text) {
    return NextResponse.json({ error: 'token, time_sec and text required' }, { status: 400 })
  }

  const { data: shareLink, error } = await supabaseAdmin
    .from('share_links')
    .select('asset_id, expires_at, password_hash, assets(deleted_at)')
    .eq('token', token)
    .single()

  if (error || !shareLink) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })

  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }

  const asset = Array.isArray(shareLink.assets) ? shareLink.assets[0] : shareLink.assets
  if (asset?.deleted_at) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })

  if (shareLink.password_hash && (!password || !verifySharePassword(password, shareLink.password_hash))) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const { data, error: insertError } = await supabaseAdmin
    .from('comments')
    .insert({
      asset_id: shareLink.asset_id,
      time_sec,
      text,
      status: 'open',
      author_id: null,
      author_name: author_name?.trim() || 'Anonymous',
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  return NextResponse.json({ comment: data }, { status: 201 })
}
