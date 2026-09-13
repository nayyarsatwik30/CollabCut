import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Cold-start login flash: on a fresh (uncached) page load, a page's very
// first getSession() call has been seen to come back with no session, then
// resolve fine on a retry. Rather than trusting a single read as gospel,
// back off across up to 3 attempts (immediate, +300ms, +600ms) before
// treating that as a confirmed "logged out". Shared by useSessionGuard
// (redirects to login) and useRedirectIfAuthenticated (redirects the
// other way) below.
export async function resolveSession(): Promise<Session | null> {
  const delays = [300, 600]

  for (let attempt = 0; ; attempt++) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) return session
    if (attempt >= delays.length) return null
    await new Promise((resolve) => setTimeout(resolve, delays[attempt]))
  }
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

    return () => { cancelled = true }
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
