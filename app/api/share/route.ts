import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hashSharePassword } from '@/lib/share-password'
import { requireAuth } from '@/lib/api-auth'
import { getPublicShareLink } from '@/lib/share-access'
import { buildShareUrl } from '@/lib/share-slug'

// POST creates the FIRST link for an asset's lineage, or (when { regenerate:
// true }) rotates the token on an existing one. Any other call just resolves
// and returns whatever's already active - ShareModal calls this on open with
// no regenerate flag, so reopening the modal reuses the same URL instead of
// minting a new token every time.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { asset_id, downloads_disabled, comments_only, expires_at, password, regenerate } = await req.json()
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const { data: assetRow, error: assetError } = await supabaseAdmin
    .from('assets')
    .select('asset_group_id, name')
    .eq('id', asset_id)
    .single()
  if (assetError || !assetRow) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  const groupId = assetRow.asset_group_id ?? asset_id

  const nowIso = new Date().toISOString()

  if (!regenerate) {
    const { data: existing } = await supabaseAdmin
      .from('share_links')
      .select('token, expires_at, downloads_disabled, comments_only, password_hash')
      .eq('asset_group_id', groupId)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        url: buildShareUrl(existing.token, assetRow.name, !!existing.password_hash),
        expires_at: existing.expires_at,
        downloads_disabled: existing.downloads_disabled,
        comments_only: existing.comments_only,
        password_protected: !!existing.password_hash,
      })
    }
  } else {
    // Regenerate: soft-invalidate whatever's currently active for this group
    // instead of leaving an ever-growing set of live tokens per asset.
    await supabaseAdmin
      .from('share_links')
      .update({ expires_at: nowIso })
      .eq('asset_group_id', groupId)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
  }

  const { data, error } = await supabaseAdmin
    .from('share_links')
    .insert({
      asset_id,
      asset_group_id: groupId,
      created_by: user.id,
      downloads_disabled: downloads_disabled ?? false,
      comments_only: comments_only ?? false,
      expires_at: expires_at ?? null,
      password_hash: password ? hashSharePassword(password) : null,
    })
    .select('token, expires_at, downloads_disabled, comments_only, password_hash')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    url: buildShareUrl(data.token, assetRow.name, !!data.password_hash),
    expires_at: data.expires_at,
    downloads_disabled: data.downloads_disabled,
    comments_only: data.comments_only,
    password_protected: !!data.password_hash,
  }, { status: 201 })
}

// Updates the currently-active share link for this asset's lineage in place
// - same token, no new row. This is what ShareModal's toggles auto-save
// through, so editing settings never rotates the URL; only POST with
// { regenerate: true } does that.
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { asset_id, downloads_disabled, comments_only, expires_at, password } = await req.json()
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const { data: assetRow, error: assetError } = await supabaseAdmin
    .from('assets')
    .select('asset_group_id')
    .eq('id', asset_id)
    .single()
  if (assetError || !assetRow) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  const groupId = assetRow.asset_group_id ?? asset_id

  const nowIso = new Date().toISOString()
  const { data: existing } = await supabaseAdmin
    .from('share_links')
    .select('id')
    .eq('asset_group_id', groupId)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'No active share link to update' }, { status: 404 })

  const update: Record<string, unknown> = {
    downloads_disabled: downloads_disabled ?? false,
    comments_only: comments_only ?? false,
    expires_at: expires_at ?? null,
  }
  // password omitted entirely -> leave password_hash untouched (the "toggle
  // is on, field left blank, keep the existing password" case). Explicit
  // null clears protection; a non-empty string sets a new one.
  if (password === null) update.password_hash = null
  else if (typeof password === 'string' && password) update.password_hash = hashSharePassword(password)

  const { data, error } = await supabaseAdmin
    .from('share_links')
    .update(update)
    .eq('id', existing.id)
    .select('password_hash')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ password_protected: !!data.password_hash })
}

// Public route (no auth) - never hand the password hash to the client, and
// getPublicShareLink() narrows the asset/versions fields so internal fields
// (notes, deadline, raw_file_url) never reach an outside reviewer.
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const result = await getPublicShareLink(token)

  if (result.status === 'not_found') return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  if (result.status === 'expired') return NextResponse.json({ error: 'Link expired' }, { status: 410 })

  return NextResponse.json({ share_link: result.shareLink })
}
