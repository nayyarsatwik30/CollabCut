import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

// A cold boot's Wi-Fi/DNS handshake is usually done well within this
// window - wait for the browser to report back online before firing our
// first network call into a gap that's likely to fail and trip the SDK's
// 60s refresh-failure cooldown (see waitForOnline below).
const OFFLINE_WAIT_MS = 2000

// If the browser is already online, resolves immediately. Otherwise waits
// for the 'online' event, up to maxWaitMs, then gives up and proceeds
// anyway - this is a best-effort delay, not a guarantee.
function waitForOnline(maxWaitMs: number): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.onLine) return Promise.resolve()

  return new Promise((resolve) => {
    const onOnline = () => {
      clearTimeout(timer)
      window.removeEventListener('online', onOnline)
      resolve()
    }
    const timer = setTimeout(() => {
      window.removeEventListener('online', onOnline)
      resolve()
    }, maxWaitMs)
    window.addEventListener('online', onOnline)
  })
}

// getSession() trusts local expires_at math to decide whether to refresh,
// which can be wrong immediately after a cold boot (the laptop's clock
// hasn't resynced yet) and hand back a session whose access_token the
// server actually considers expired. getUser() hits Supabase's server
// instead of the local clock, so it catches what getSession() can miss.
async function verifiedByServer(session: Session): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser(session.access_token)
  return !!user
}

// Cold-start login flash: on a fresh (uncached) page load, a page's very
// first getSession() call has been seen to come back with no session, then
// resolve fine on a retry. Rather than trusting a single read as gospel,
// back off across up to 3 attempts (immediate, +300ms, +600ms) before
// treating that as a confirmed "logged out". Shared by useSessionGuard
// (redirects to login) and useRedirectIfAuthenticated (redirects the
// other way) below.
export async function resolveSession(): Promise<Session | null> {
  const delays = [300, 600]

  await waitForOnline(OFFLINE_WAIT_MS)

  let session: Session | null = null

  for (let attempt = 0; ; attempt++) {
    const { data } = await supabase.auth.getSession()
    session = data.session
    if (session) break
    if (attempt >= delays.length) return null
    await new Promise((resolve) => setTimeout(resolve, delays[attempt]))
  }

  if (await verifiedByServer(session)) return session

  // Local session looked present but the server rejected its access_token -
  // force a real refresh using the refresh_token read straight off this
  // session object, rather than trusting any cached/in-memory SDK state.
  const { data: { session: refreshed } } = await supabase.auth.refreshSession({
    refresh_token: session.refresh_token,
  })

  return refreshed
}

// For pages that require a session: callers must wait for `ready` before
// doing anything auth-dependent, so no page can redirect off a too-early
// read.
export function useSessionGuard() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    resolveSession().then((session) => {
      if (cancelled) return
      if (session) {
        setSession(session)
        setReady(true)
      } else {
        router.push('/auth/login')
      }
    })

    // autoRefreshToken silently rotates the access_token in the background
    // and fires TOKEN_REFRESHED - without this, every page kept holding the
    // original session from mount and sending the now-expired token on
    // every fetch until a full reload/re-login. SIGNED_OUT is deliberately
    // not handled here - SessionSync already confirms it with the same
    // retry-backed resolveSession() check before redirecting, so reacting
    // to it here too would risk a false "logged out" flash on the same
    // startup race that check exists to guard against.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return
      if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && newSession) {
        setSession(newSession)
      }
    })

    return () => { cancelled = true; subscription.unsubscribe() }
  }, [router])

  return { session, ready }
}

// The mirror image, for pages that should skip straight past their own
// logged-out content when a session already exists (e.g. the marketing
// landing page): redirects to `destination` if a session is found, and
// otherwise does nothing at all - no ready/loading state, since the
// logged-out case (the common case here) should render immediately with
// no flash or wait on this check.
export function useRedirectIfAuthenticated(destination: string) {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    resolveSession().then((session) => {
      if (!cancelled && session) router.replace(destination)
    })

    return () => { cancelled = true }
  }, [router, destination])
}
