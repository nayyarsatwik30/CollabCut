const TOKEN_RE = /[0-9a-f]{24}$/

// Cosmetic slug only - never used for lookup or auth. See extractShareToken.
export function slugifyAssetName(name: string): string {
  return name
    .replace(/\.[^/.]+$/, '') // strip extension
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Shared by every POST /api/share branch (fresh insert or reused row) so the
// slug rule can't drift between them.
export function buildShareUrl(token: string, assetName: string | null | undefined): string {
  const slug = assetName ? slugifyAssetName(assetName) : ''
  return `${process.env.NEXT_PUBLIC_APP_URL}/r/${slug ? `${slug}-` : ''}${token}`
}

// Recovers the real lookup token from a /r/<segment> route param, whether
// it's a bare legacy token or a new <slug>-<token> segment. The token is
// always a fixed 24-char lowercase hex string (share_links.token's
// `encode(gen_random_bytes(12), 'hex')` default), which can never contain
// a hyphen - so matching it as a trailing suffix is unambiguous no matter
// what the slug contains. Everything before the match is discarded.
export function extractShareToken(routeParam: string): string | null {
  const match = routeParam.match(TOKEN_RE)
  return match ? match[0] : null
}
