import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import {
  RESEND_COOLDOWN_SECONDS,
  VERIFICATION_TTL_HOURS,
  createVerificationToken,
  sendVerificationEmail,
} from '@/lib/email-verification'

// Public endpoint, so it always answers { ok: true } - whether or not the
// email exists, is already verified, or was skipped by the cooldown - to avoid
// leaking which emails have accounts. The cooldown is enforced in SQL: the
// previous send time is expires - TTL, and the UPDATE only matches (and
// returns a row to email) once RESEND_COOLDOWN_SECONDS has passed.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) return NextResponse.json({ ok: true })

  const { token, hash, expires } = createVerificationToken()

  try {
    const result = await migrationDb.query(
      `UPDATE auth_credentials a
       SET email_verification_token_hash = $2, email_verification_expires = $3
       FROM profiles p
       WHERE p.id = a.id
         AND a.email = $1
         AND a.email_verified_at IS NULL
         AND (a.email_verification_expires IS NULL
              OR a.email_verification_expires - make_interval(hours => $4)
                 < now() - make_interval(secs => $5))
       RETURNING p.name`,
      [email, hash, expires, VERIFICATION_TTL_HOURS, RESEND_COOLDOWN_SECONDS]
    )
    const row = result.rows[0]
    if (row) await sendVerificationEmail(email, row.name, token)
  } catch (err) {
    console.error('resend-verification failed', err)
  }

  return NextResponse.json({ ok: true })
}
