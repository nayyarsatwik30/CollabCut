import { supabaseAdmin } from './supabase-admin'
import { verifySharePassword } from './share-password'

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
