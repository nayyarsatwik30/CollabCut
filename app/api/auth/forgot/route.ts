import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import {
  RESET_COOLDOWN_SECONDS,
  createResetToken,
  isValidEmail,
  sendPasswordResetEmailInBackground,
} from '@/lib/email-verification'

// Public endpoint: always answers { ok: true } - unknown email, bad format,
// cooldown hit, DB error or failed send all look the same to the caller. The
// cooldown is enforced inside the UPDATE (reset_requested_at), so concurrent
// requests can't both issue a token. Only the token's SHA-256 is stored. The
// email goes out in the background so response time doesn't reveal whether an
// account matched.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!isValidEmail(email)) return NextResponse.json({ ok: true })

  const { token, hash, expires } = createResetToken()

  try {
    const result = await migrationDb.query(
      `UPDATE auth_credentials a
       SET reset_token_hash = $2, reset_token_expires_at = $3, reset_requested_at = now()
       FROM profiles p
       WHERE p.id = a.id
         AND a.email = $1
         AND (a.reset_requested_at IS NULL
              OR a.reset_requested_at < now() - make_interval(secs => $4))
       RETURNING p.name`,
      [email, hash, expires, RESET_COOLDOWN_SECONDS]
    )
    const row = result.rows[0]
    if (row) sendPasswordResetEmailInBackground(email, row.name, token)
  } catch (err) {
    console.error('forgot-password failed', err)
  }

  return NextResponse.json({ ok: true })
}
