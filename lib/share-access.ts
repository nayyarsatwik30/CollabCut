import { supabaseAdmin } from './supabase-admin'
import { verifySharePassword } from './share-password'

export interface PublicShareLink {
  token: string
  expires_at: string | null
  downloads_disabled: boolean
  comments_only: boolean
  password_protected: boolean
  asset: {
    id: string
    name: string
    mux_playback_id: string | null
    mux_upload_id: string | null
    is_complete: boolean
  }
}

export type PublicShareLinkResult =
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'ok'; shareLink: PublicShareLink }

// Single source of truth for resolving a public /r/[token] link - used by
// both GET /api/share (the client's data fetch) and generateMetadata (the
// server-rendered OG preview), so the two can never disagree about what's
// safe to expose for a given token.
export async function getPublicShareLink(token: string): Promise<PublicShareLinkResult> {
  const { data, error } = await supabaseAdmin
    .from('share_links')
    .select('token, expires_at, downloads_disabled, comments_only, password_hash, assets(id, name, mux_playback_id, mux_upload_id, is_complete, deleted_at)')
    .eq('token', token)
    .single()

  if (error || !data) return { status: 'not_found' }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { status: 'expired' }
  }

  const asset = Array.isArray(data.assets) ? data.assets[0] : data.assets
  if (!asset || asset.deleted_at) return { status: 'not_found' }

  return {
    status: 'ok',
    shareLink: {
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
  }
}

// Re-verifies a share token against share_links on every call, the same
// trust model /api/share/comments already uses for the public /r/[token]
// page - never rely on the client having already passed the unlock gate.
export async function verifyShareAccess(
  assetId: string,
  token: string,
  password: string | null,
): Promise<boolean> {
  const { data: shareLink, error } = await supabaseAdmin
    .from('share_links')
    .select('asset_id, expires_at, password_hash, assets(deleted_at)')
    .eq('token', token)
    .maybeSingle()

  if (error || !shareLink) return false
  if (shareLink.asset_id !== assetId) return false
  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) return false

  const asset = Array.isArray(shareLink.assets) ? shareLink.assets[0] : shareLink.assets
  if (asset?.deleted_at) return false

  if (shareLink.password_hash) {
    if (!password || !verifySharePassword(password, shareLink.password_hash)) return false
  }

  return true
}
