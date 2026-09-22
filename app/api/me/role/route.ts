import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'

// Every workspace_members role the caller holds - dashboard and the review
// page both need this client-side to pick which view to render (editor vs
// admin), not just to gate a single action.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const result = await migrationDb.query(
    `SELECT role FROM workspace_members WHERE user_id = $1`,
    [auth.user.id]
  )

  return NextResponse.json({ roles: result.rows.map((r) => r.role) })
}
