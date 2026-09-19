import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
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

  const result = await migrationDb.query(
    `INSERT INTO comments (asset_id, time_sec, text, status, author_id, author_name)
     VALUES ($1, $2, $3, 'open', NULL, $4)
     RETURNING *`,
    [asset_id, time_sec, text, author_name?.trim() || 'Anonymous']
  )

  return NextResponse.json({ comment: result.rows[0] }, { status: 201 })
}
