import { NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { getSessionUserId } from '@/lib/migrationAuth'

export async function POST(req: Request) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { asset_id } = await req.json()
  if (!asset_id) {
    return NextResponse.json({ error: 'asset_id is required' }, { status: 400 })
  }

  const asset = await migrationDb.query('SELECT id, asset_group_id FROM assets WHERE id = $1', [asset_id])
  if (asset.rows.length === 0) {
    return NextResponse.json({ error: 'asset not found' }, { status: 404 })
  }

  const result = await migrationDb.query(
    `INSERT INTO share_links (asset_id, asset_group_id, created_by)
     VALUES ($1, $2, $3)
     RETURNING token`,
    [asset_id, asset.rows[0].asset_group_id, userId]
  )

  return NextResponse.json({ token: result.rows[0].token }, { status: 201 })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const result = await migrationDb.query(
    `SELECT a.id, a.name, a.mux_playback_id, a.duration_sec, a.status
     FROM share_links s
     JOIN assets a ON a.id = s.asset_id
     WHERE s.token = $1`,
    [token]
  )
  const row = result.rows[0]
  if (!row) {
    return NextResponse.json({ error: 'invalid share link' }, { status: 404 })
  }

  return NextResponse.json(row)
}
