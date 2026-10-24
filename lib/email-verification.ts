import { createHash, randomBytes } from 'crypto'
import { appUrl, sendEmail, sendEmailInBackground } from './email'

export const VERIFICATION_TTL_HOURS = 24
// A resend within this window of the last send is silently skipped, so the
// public resend endpoint can't be used to spam an inbox.
export const RESEND_COOLDOWN_SECONDS = 60

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// Only the hash is stored (auth_credentials.email_verification_token_hash), so
// a DB dump can't be used to verify accounts; the raw token only ever exists
// in the emailed link.
export function createVerificationToken() {
  const token = randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + VERIFICATION_TTL_HOURS * 60 * 60 * 1000)
  return { token, hash: hashToken(token), expires }
}

export function hashVerificationToken(token: string): string {
  return hashToken(token)
}

// Both wrappers build the verification email through sendEmail, so it gets
// the shared branded template. sendVerificationEmail throws on failure (signup
// treats that as recoverable via resend); the InBackground variant never
// awaits or throws - see sendEmailInBackground in lib/email.ts.
function verificationEmail(to: string, name: string, token: string) {
  return {
    to,
    subject: 'Verify your CollabCut email',
    heading: 'Verify your email',
    body: `Hi ${name},

Confirm your email to activate your CollabCut account. This link expires in ${VERIFICATION_TTL_HOURS} hours.`,
    buttonLabel: 'Verify my email',
    buttonUrl: `${appUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
    footer: "If you didn't sign up for CollabCut, you can safely ignore this email.",
  }
}

export function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  return sendEmail(verificationEmail(to, name, token))
}

export function sendVerificationEmailInBackground(to: string, name: string, token: string): void {
  sendEmailInBackground(verificationEmail(to, name, token))
}
