'use client'

import { useEffect } from 'react'
import { SessionProvider, signOut, useSession } from 'next-auth/react'

const LOGGED_IN_ELSEWHERE_URL = '/auth/login?reason=elsewhere'

// One-shot per page load, so a burst of 401s (polling + parallel fetches)
// signs out and redirects exactly once instead of looping.
let handlingRevocation = false

async function handleRevokedSession() {
  if (handlingRevocation) return
  if (window.location.pathname.startsWith('/auth/')) return
  handlingRevocation = true
  await signOut({ redirect: false }).catch(() => {})
  // Full navigation (not router.push) so every mounted page's in-memory
  // state and pollers are dropped along with the dead session.
  window.location.assign(LOGGED_IN_ELSEWHERE_URL)
}

// Single active session per account (see authOptions' jwt callback): when
// another login replaces this session's token, the next request fails.
// Two ways that surfaces here, both ending at the login page with a
// "logged in elsewhere" message:
//  1. /api/auth/session (useSession focus refetch) returns { invalid: true }.
//  2. Any same-origin API call 401s with X-Auth-Reason: session-invalid
//     (set by requireAuth). Intercepting fetch once here covers every
//     existing call site instead of wrapping each of them.
function SessionRevocationWatcher() {
  const { data } = useSession()
  const invalid = (data as { invalid?: boolean } | null)?.invalid === true

  useEffect(() => {
    if (invalid) void handleRevokedSession()
  }, [invalid])

  useEffect(() => {
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      if (response.status === 401 && response.headers.get('X-Auth-Reason') === 'session-invalid') {
        void handleRevokedSession()
      }
      return response
    }
    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return null
}

// next-auth v4's SessionProvider predates the 'use client' convention, so
// app/layout.tsx (a Server Component) can't import it directly - Next treats
// the whole module as server code and blows up trying to use React Context.
// This one-line wrapper is the client boundary Next needs.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionRevocationWatcher />
      {children}
    </SessionProvider>
  )
}
