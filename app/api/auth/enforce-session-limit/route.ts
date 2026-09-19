import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

// Called once, right after a fresh sign-in - never on token refresh.
//
// KNOWN GAP (post-migration follow-up, not yet implemented): under Supabase,
// this called the enforce_session_limit() RPC, which deleted the oldest rows
// out of auth.sessions (GoTrue's server-side session table) past
// MAX_SESSIONS for self-serve accounts, immediately invalidating those
// devices' refresh tokens. NextAuth here uses `session: { strategy: 'jwt' }`
// (see lib/authOptions.ts) - there is no server-side session table under
// CloudClusters, no adapter, and the signed JWT lives entirely in the
// client's cookie. There is nothing to count and nothing to delete, so
// concurrent-session eviction is NOT enforced right now: a self-serve
// account can hold more than MAX_SESSIONS live sessions simultaneously.
//
// Implementing this for real needs a design decision, not a mechanical
// port - e.g. adding a real `sessions` table keyed by a session id embedded
// in the JWT and checked on every request (requireAuth would need a DB
// round-trip per call, which the JWT strategy was chosen to avoid), or
// switching next-auth to `session: { strategy: 'database' }` with a
// CloudClusters-backed Adapter so next-auth owns eviction itself. Left as a
// no-op instead of silently pretending either of those exists.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  return NextResponse.json({ ok: true })
}
