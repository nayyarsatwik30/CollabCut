import { createHash, randomBytes } from 'crypto'
import nodemailer from 'nodemailer'
import { waitUntil } from '@vercel/functions'

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

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
}

// Exactly one plain address: no whitespace, list separators (, ;), display-name
// or quoting characters. Nodemailer treats a "to" string containing commas as
// several recipients, so anything looser would let a crafted signup email use
// our Gmail account as a spam relay.
const SINGLE_ADDRESS = /^[^\s@,;:<>()[\]\\"']+@[^\s@,;:<>()[\]\\"']+\.[^\s@,;:<>()[\]\\"']+$/

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && SINGLE_ADDRESS.test(value)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

// Throws if GMAIL_USER / GMAIL_APP_PASSWORD are unset or SMTP rejects the
// message; callers decide whether that's fatal (signup treats it as
// recoverable via resend).
export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  if (!isValidEmail(to)) throw new Error('Refusing to send: recipient is not a single plain email address')

  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD are not configured')

  const link = `${appUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })

  await transporter.sendMail({
    from: `CollabCut <${user}>`,
    to,
    subject: 'Verify your CollabCut email',
    text:
      `Hi ${name},\n\nConfirm your email to activate your CollabCut account:\n${link}\n\n` +
      `This link expires in ${VERIFICATION_TTL_HOURS} hours. If you didn't sign up, ignore this email.`,
    html:
      `<p>Hi ${escapeHtml(name)},</p>` +
      `<p>Confirm your email to activate your CollabCut account:</p>` +
      `<p><a href="${link}">Verify my email</a></p>` +
      `<p style="color:#666;font-size:12px">This link expires in ${VERIFICATION_TTL_HOURS} hours. ` +
      `If you didn't sign up, ignore this email.</p>`,
  })
}

// Sends without making the caller wait, so a public endpoint's response timing
// doesn't depend on whether an email was actually sent. Failures are logged,
// never thrown. waitUntil keeps the serverless invocation alive until the SMTP
// send finishes (a bare un-awaited promise can be frozen once the response is
// out); outside Vercel it is a no-op and the promise just runs.
export function sendVerificationEmailInBackground(to: string, name: string, token: string): void {
  waitUntil(
    sendVerificationEmail(to, name, token).catch((err) => {
      console.error('background verification email failed', err)
    })
  )
}
