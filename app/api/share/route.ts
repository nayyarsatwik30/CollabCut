import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { hashSharePassword } from '@/lib/share-password'
import { requireAuth, canAccessAsset } from '@/lib/api-auth'
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

  const assetResult = await migrationDb.query(
    `SELECT asset_group_id, name FROM assets WHERE id = $1`,
    [asset_id]
  )
  const assetRow = assetResult.rows[0]
  if (!assetRow) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  if (!(await canAccessAsset(user.id, asset_id))) {
    return NextResponse.json({ error: 'Not authorized to share this asset' }, { status: 403 })
  }
  const groupId = assetRow.asset_group_id ?? asset_id

  if (!regenerate) {
    const existingResult = await migrationDb.query(
      `SELECT token, expires_at, downloads_disabled, comments_only, password_hash
       FROM share_links
       WHERE asset_group_id = $1 AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at DESC
       LIMIT 1`,
      [groupId]
    )
    const existing = existingResult.rows[0]

    if (existing) {
      return NextResponse.json({
        url: buildShareUrl(existing.token, assetRow.name),
        expires_at: existing.expires_at,
        downloads_disabled: existing.downloads_disabled,
        comments_only: existing.comments_only,
        password_protected: !!existing.password_hash,
      })
    }
  } else {
    // Regenerate: soft-invalidate whatever's currently active for this group
    // instead of leaving an ever-growing set of live tokens per asset.
    await migrationDb.query(
      `UPDATE share_links SET expires_at = now()
       WHERE asset_group_id = $1 AND (expires_at IS NULL OR expires_at > now())`,
      [groupId]
    )
  }

  const insertResult = await migrationDb.query(
    `INSERT INTO share_links (asset_id, asset_group_id, created_by, downloads_disabled, comments_only, expires_at, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING token, expires_at, downloads_disabled, comments_only, password_hash`,
    [
      asset_id,
      groupId,
      user.id,
      downloads_disabled ?? false,
      comments_only ?? false,
      expires_at ?? null,
      password ? hashSharePassword(password) : null,
    ]
  )
  const data = insertResult.rows[0]

  return NextResponse.json({
    url: buildShareUrl(data.token, assetRow.name),
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
  const { user } = auth

  const { asset_id, downloads_disabled, comments_only, expires_at, password } = await req.json()
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const assetResult = await migrationDb.query(
    `SELECT asset_group_id FROM assets WHERE id = $1`,
    [asset_id]
  )
  const assetRow = assetResult.rows[0]
  if (!assetRow) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  if (!(await canAccessAsset(user.id, asset_id))) {
    return NextResponse.json({ error: 'Not authorized to change this share link' }, { status: 403 })
  }
  const groupId = assetRow.asset_group_id ?? asset_id

  const existingResult = await migrationDb.query(
    `SELECT id FROM share_links
     WHERE asset_group_id = $1 AND (expires_at IS NULL OR expires_at > now())
     ORDER BY created_at DESC
     LIMIT 1`,
    [groupId]
  )
  const existing = existingResult.rows[0]

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

  const fields = Object.keys(update)
  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ')
  const values = fields.map((field) => update[field])

  const result = await migrationDb.query(
    `UPDATE share_links SET ${setClause} WHERE id = $${fields.length + 1} RETURNING password_hash`,
    [...values, existing.id]
  )

  return NextResponse.json({ password_protected: !!result.rows[0].password_hash })
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
