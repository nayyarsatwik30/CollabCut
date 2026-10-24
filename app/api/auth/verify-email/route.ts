import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { appUrl, hashVerificationToken } from '@/lib/email-verification'

// Target of the emailed link. Single atomic UPDATE: the token must exist, be
// unexpired and belong to a still-unverified account, and is cleared in the
// same statement so a link only ever works once. Always ends in a redirect to
// the login page (success or failure message via query string).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const login = (query: string) => NextResponse.redirect(`${appUrl()}/auth/login?${query}`)

  if (!token || token.length > 200) return login('verify_error=invalid')

  try {
    const result = await migrationDb.query(
      `UPDATE auth_credentials
       SET email_verified_at = now(),
           email_verification_token_hash = NULL,
           email_verification_expires = NULL
       WHERE email_verification_token_hash = $1
         AND email_verification_expires > now()
         AND email_verified_at IS NULL
       RETURNING id`,
      [hashVerificationToken(token)]
    )
    if (result.rows.length === 0) return login('verify_error=invalid')
  } catch (err) {
    console.error('verify-email failed', err)
    return login('verify_error=server')
  }

  return login('verified=1')
}
