import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { migrationDb } from '@/lib/migrationDb'

// Shared by settings.tsx's plan switcher (plan_id only) and SignupForm's
// post-signup plan selection (plan_id + billing_cycle). billing_cycle is
// optional so settings can update plan_id alone without touching the
// billing cycle the user already picked.
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { plan_id, billing_cycle } = await req.json()
  if (typeof plan_id !== 'string' || !plan_id) {
    return NextResponse.json({ error: 'plan_id is required' }, { status: 400 })
  }
  if (billing_cycle !== undefined && billing_cycle !== 'monthly' && billing_cycle !== 'yearly') {
    return NextResponse.json({ error: 'billing_cycle must be monthly or yearly' }, { status: 400 })
  }

  try {
    if (billing_cycle) {
      await migrationDb.query(
        `UPDATE profiles SET plan_id = $1, billing_cycle = $2 WHERE id = $3`,
        [plan_id, billing_cycle, auth.user.id]
      )
    } else {
      await migrationDb.query(`UPDATE profiles SET plan_id = $1 WHERE id = $2`, [plan_id, auth.user.id])
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
