import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'

// Just plan_id for now - name/email already come from the session
// (authOptions puts them on the JWT at login), so there's nothing else
// settings.tsx's initial load needs from profiles itself yet.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const result = await migrationDb.query(
    `SELECT plan_id FROM profiles WHERE id = $1`,
    [auth.user.id]
  )

  return NextResponse.json({ plan_id: result.rows[0]?.plan_id ?? null })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { name } = await req.json()
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  await migrationDb.query(`UPDATE profiles SET name = $1 WHERE id = $2`, [name.trim(), auth.user.id])

  return NextResponse.json({ ok: true })
}
