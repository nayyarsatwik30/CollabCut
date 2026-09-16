import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyShareAccess } from '@/lib/share-access'

// Public, unauthenticated - the /r/[token] page has no user JWT to send.
// Trust is rooted entirely in the share token (and its password, if set)
// plus the requested asset_id belonging to that token's lineage - re-verified
// here on every request rather than relying on the client having already
// passed the unlock gate. asset_id is the version currently being viewed on
// the public page, not necessarily the version the link was created against.
export async function POST(req: NextRequest) {
  const { token, asset_id, time_sec, text, author_name, password } = await req.json()

  if (!token || !asset_id || time_sec === undefined || !text) {
    return NextResponse.json({ error: 'token, asset_id, time_sec and text required' }, { status: 400 })
  }

  const authorized = await verifyShareAccess(asset_id, token, password ?? null)
  if (!authorized) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })

  const { data, error: insertError } = await supabaseAdmin
    .from('comments')
    .insert({
      asset_id,
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
