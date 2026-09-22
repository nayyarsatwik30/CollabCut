import { migrationDb } from './migrationDb'
import { verifySharePassword } from './share-password'

export interface PublicShareVersion {
  id: string
  version: number
  name: string
  status: string
  created_at: string
  size_bytes: number
  mux_playback_id: string | null
  mux_upload_id: string | null
  is_complete: boolean
}

export interface PublicShareLink {
  token: string
  expires_at: string | null
  downloads_disabled: boolean
  comments_only: boolean
  password_protected: boolean
  default_version_id: string
  versions: PublicShareVersion[]
  asset: PublicShareVersion // = versions.find(v => v.id === default_version_id); kept so generateMetadata() doesn't need to change
}

export type PublicShareLinkResult =
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'ok'; shareLink: PublicShareLink }

// Single source of truth for resolving a public /r/[token] link - used by
// both GET /api/share (the client's data fetch) and generateMetadata (the
// server-rendered OG preview), so the two can never disagree about what's
// safe to expose for a given token. Resolves the whole asset_group_id
// lineage instead of one pinned asset row, so a link automatically picks up
// versions uploaded after it was created.
export async function getPublicShareLink(token: string): Promise<PublicShareLinkResult> {
  const linkResult = await migrationDb.query(
    `SELECT token, expires_at, downloads_disabled, comments_only, password_hash, asset_group_id
     FROM share_links WHERE token = $1`,
    [token]
  )
  const data = linkResult.rows[0]

  if (!data) return { status: 'not_found' }
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { status: 'expired' }

  const versionsResult = await migrationDb.query(
    `SELECT id, version, name, status, created_at, size_bytes, mux_playback_id, mux_upload_id, is_complete, deleted_at
     FROM assets WHERE asset_group_id = $1 ORDER BY version DESC`,
    [data.asset_group_id]
  )
  const rows = versionsResult.rows

  const versions = rows.filter((v) => !v.deleted_at).map(({ deleted_at, ...v }) => v)
  if (versions.length === 0) return { status: 'not_found' } // whole lineage soft-deleted

  const latest = versions[0] // already ordered desc by version

  return {
    status: 'ok',
    shareLink: {
      token: data.token,
      expires_at: data.expires_at,
      downloads_disabled: data.downloads_disabled,
      comments_only: data.comments_only,
      password_protected: !!data.password_hash,
      default_version_id: latest.id,
      versions,
      asset: latest,
    },
  }
}

// Re-verifies a share token against share_links on every call, the same
// trust model /api/share/comments already uses for the public /r/[token]
// page - never rely on the client having already passed the unlock gate.
// Checks lineage membership (asset_group_id) instead of an exact asset_id
// match, so any sibling version of the link's group is authorized - required
// once the public page can switch versions within one link.
export async function verifyShareAccess(
  assetId: string,
  token: string,
  password: string | null,
): Promise<boolean> {
  const shareLinkResult = await migrationDb.query(
    `SELECT asset_group_id, expires_at, password_hash FROM share_links WHERE token = $1`,
    [token]
  )
  const shareLink = shareLinkResult.rows[0]

  if (!shareLink) return false
  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) return false

  const versionResult = await migrationDb.query(
    `SELECT asset_group_id, deleted_at FROM assets WHERE id = $1`,
    [assetId]
  )
  const version = versionResult.rows[0]

  if (!version || version.deleted_at) return false
  if (version.asset_group_id !== shareLink.asset_group_id) return false

  if (shareLink.password_hash) {
    if (!password || !verifySharePassword(password, shareLink.password_hash)) return false
  }

  return true
}
