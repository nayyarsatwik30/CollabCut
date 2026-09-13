import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hashSharePassword } from '@/lib/share-password'
import { requireAuth } from '@/lib/api-auth'
import { getPublicShareLink } from '@/lib/share-access'
import { slugifyAssetName } from '@/lib/share-slug'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

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
    .select('*, assets(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { password_hash, assets, ...safeShareLink } = data as any
  const assetName = Array.isArray(assets) ? assets[0]?.name : assets?.name
  // Password-protected links must never leak the real name via the URL
  // itself - same reasoning as generateMetadata() suppressing the OG
  // title/thumbnail for these links.
  const slug = !password_hash && assetName ? slugifyAssetName(assetName) : ''
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/r/${slug ? `${slug}-` : ''}${data.token}`
  return NextResponse.json({ share_link: safeShareLink, url }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const result = await getPublicShareLink(token)

  if (result.status === 'not_found') return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  if (result.status === 'expired') return NextResponse.json({ error: 'Link expired' }, { status: 410 })

  // Public route (no auth) - never hand the password hash to the client,
  // and narrow the asset down from assets(*) so internal fields (notes,
  // deadline, raw_file_url) never reach an outside reviewer.
  return NextResponse.json({ share_link: result.shareLink })
}