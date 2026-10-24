import nodemailer from 'nodemailer'
import { waitUntil } from '@vercel/functions'
import { renderEmail, type EmailContent } from './email-template'

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

export type SendEmailInput = Omit<EmailContent, 'baseUrl'> & {
  to: string
  subject: string
}

// The one way every transactional email leaves the app (verification, resend,
// and future password reset / workspace invites): content is rendered through
// the shared template in lib/email-template.ts, so they all look the same.
// Throws if GMAIL_USER / GMAIL_APP_PASSWORD are unset, the recipient isn't a
// single plain address, or SMTP rejects the message; callers decide whether
// that's fatal.
export async function sendEmail({ to, subject, ...content }: SendEmailInput): Promise<void> {
  if (!isValidEmail(to)) throw new Error('Refusing to send: recipient is not a single plain email address')

  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD are not configured')

  const { html, text } = renderEmail({ ...content, baseUrl: appUrl() })
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })

  await transporter.sendMail({
    from: `CollabCut <${user}>`,
    to,
    subject: subject.replace(/[\r\n]+/g, ' '),
    text,
    html,
  })
}

// Sends without making the caller wait, so a public endpoint's response timing
// doesn't depend on whether an email was actually sent. Failures are logged,
// never thrown. waitUntil keeps the serverless invocation alive until the SMTP
// send finishes (a bare un-awaited promise can be frozen once the response is
// out); outside Vercel it is a no-op and the promise just runs.
export function sendEmailInBackground(input: SendEmailInput): void {
  waitUntil(
    sendEmail(input).catch((err) => {
      console.error('background email failed', err)
    })
  )
}
