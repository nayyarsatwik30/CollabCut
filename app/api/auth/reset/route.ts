import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { hashPassword } from '@/lib/password'
import { hashVerificationToken, sendPasswordChangedEmailInBackground } from '@/lib/email-verification'

const INVALID = { error: 'This reset link is invalid or has expired.' }

// One UPDATE both checks the token and consumes it, so a token works exactly
// once even under concurrent requests (the second UPDATE finds the hash
// already NULLed). current_session_token = NULL makes the jwt callback in
// lib/authOptions.ts reject every existing JWT on its next request
// (valid = !!current && current === t.sessionToken). Nobody is auto-logged in.
// The bcrypt hash is computed before the UPDATE, so valid and invalid tokens
// cost the same and the response doesn't distinguish expired from unknown.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const token = typeof body?.token === 'string' ? body.token : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  // Same rule as signup (app/api/auth/signup/route.ts): at least 8 characters.
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (!token || token.length > 256) return NextResponse.json(INVALID, { status: 400 })

  try {
    const passwordHash = await hashPassword(password)
    const result = await migrationDb.query(
      `UPDATE auth_credentials
       SET password_hash = $2,
           reset_token_hash = NULL,
           reset_token_expires_at = NULL,
           reset_requested_at = NULL,
           current_session_token = NULL
       WHERE reset_token_hash = $1
         AND reset_token_expires_at > now()
       RETURNING email, (SELECT name FROM profiles WHERE id = auth_credentials.id) AS name`,
      [hashVerificationToken(token), passwordHash]
    )
    const row = result.rows[0]
    if (!row) return NextResponse.json(INVALID, { status: 400 })

    // After the commit; a failed notification must not fail the reset.
    sendPasswordChangedEmailInBackground(row.email, row.name ?? 'there', new Date())
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('password reset failed', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
