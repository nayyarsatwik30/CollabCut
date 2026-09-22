import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { read } = await req.json()

  const result = await migrationDb.query(
    `UPDATE notifications SET read = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
    [read ?? true, params.id, user.id]
  )

  const notification = result.rows[0]
  if (!notification) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })

  return NextResponse.json({ notification })
}
