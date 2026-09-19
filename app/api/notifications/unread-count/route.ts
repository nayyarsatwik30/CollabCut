import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'

// Lightweight endpoint for the sidebar badge - avoids fetching every
// notification's full row just to know how many are unread.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const result = await migrationDb.query(
    `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false`,
    [user.id]
  )

  return NextResponse.json({ count: Number(result.rows[0].count) })
}
