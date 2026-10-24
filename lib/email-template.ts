// Shared look for every transactional email (verification, resend, and future
// password-reset / workspace-invite mails). Pure: no imports, no env access -
// callers pass baseUrl so the logo can be loaded from the deployed site.
//
// Layout is table-based with inline styles only, because email clients strip
// <style> blocks and ignore most modern CSS. The wordmark is real text, so the
// header still reads if the logo image is blocked.

// Single place to change when the product is renamed.
const BRAND_NAME = 'COLLABCUT'
const LOGO_PATH = '/collabcut-mark.png'

const COLORS = {
  page: '#f4f4f2',
  card: '#ffffff',
  border: '#e2e2df',
  text: '#1a1a1a',
  muted: '#6b6b6b',
  button: '#1a1a1a',
  buttonText: '#ffffff',
}
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export type EmailContent = {
  heading: string
  // Plain text. A blank line starts a new paragraph, a single newline is a line break.
  body: string
  buttonLabel: string
  buttonUrl: string
  // Small print under the card, e.g. "If you didn't sign up, ignore this email."
  footer?: string
  // Site origin (no trailing slash) used to load the logo; omit to skip the image.
  baseUrl?: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function assertHttpUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Email button URL is not a valid URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Email button URL must be http(s)')
  }
  return value
}

function paragraphs(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${COLORS.text};">` +
        `${escapeHtml(p).replace(/\n/g, '<br>')}</p>`
    )
    .join('')
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const { heading, body, buttonLabel, footer } = content
  const buttonUrl = assertHttpUrl(content.buttonUrl)
  const url = escapeHtml(buttonUrl)
  const logo = content.baseUrl
    ? `<img src="${escapeHtml(content.baseUrl + LOGO_PATH)}" width="24" height="24" alt="" ` +
      `style="display:inline-block;vertical-align:middle;border:0;margin-right:8px;">`
    : ''

  const html =
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="color-scheme" content="light only"><title>${escapeHtml(heading)}</title></head>` +
    `<body style="margin:0;padding:0;background:${COLORS.page};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">` +
    `<tr><td align="center" style="padding:32px 16px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="max-width:560px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;">` +
    // header
    `<tr><td style="padding:24px 32px;border-bottom:1px solid ${COLORS.border};font-family:${FONT};">` +
    `${logo}<span style="vertical-align:middle;font-size:17px;font-weight:800;letter-spacing:-0.01em;color:${COLORS.text};">${escapeHtml(BRAND_NAME)}</span>` +
    `</td></tr>` +
    // content
    `<tr><td style="padding:32px;font-family:${FONT};">` +
    `<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;font-weight:800;color:${COLORS.text};">${escapeHtml(heading)}</h1>` +
    paragraphs(body) +
    // bulletproof button: the colored cell carries the background for clients that ignore <a> padding
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr>` +
    `<td align="center" bgcolor="${COLORS.button}" style="border-radius:999px;background:${COLORS.button};">` +
    `<a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:15px;font-weight:600;` +
    `color:${COLORS.buttonText};text-decoration:none;border-radius:999px;">${escapeHtml(buttonLabel)}</a>` +
    `</td></tr></table>` +
    // plain link fallback
    `<p style="margin:0;font-size:12px;line-height:18px;color:${COLORS.muted};">Button not working? Copy and paste this link into your browser:<br>` +
    `<a href="${url}" target="_blank" style="color:${COLORS.muted};word-break:break-all;">${url}</a></p>` +
    `</td></tr></table>` +
    (footer
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;"><tr>` +
        `<td style="padding:16px 8px;font-family:${FONT};font-size:12px;line-height:18px;color:${COLORS.muted};text-align:center;">${escapeHtml(footer)}</td></tr></table>`
      : '') +
    `</td></tr></table></body></html>`

  const text =
    `${heading}\n\n${body.trim()}\n\n${buttonLabel}:\n${buttonUrl}` + (footer ? `\n\n${footer}` : '') + '\n'

  return { html, text }
}
