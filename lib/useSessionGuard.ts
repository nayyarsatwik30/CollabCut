import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, getSession } from 'next-auth/react'

// Shaped like the old Supabase Session so every existing call site
// (session.user.id, .user.email, .user.user_metadata?.name,
// .access_token) keeps working untouched. access_token is always '' -
// lib/api-auth.ts's requireAuth verifies the session cookie server-side via
// getServerSession and never reads this header; it's kept only so call
// sites that still build an `Authorization: Bearer` header out of habit
// don't need to change today.
export type GuardSession = {
  user: { id: string; email: string; user_metadata?: { name?: string } }
  access_token: string
}

function toGuardSession(
  session: { user?: { id?: string; email?: string | null; name?: string | null } } | null | undefined
): GuardSession | null {
  const user = session?.user
  if (!user?.id) return null
  return {
    user: { id: user.id, email: user.email ?? '', user_metadata: { name: user.name ?? undefined } },
    access_token: '',
  }
}

// Standalone session read for call sites outside a React render (Sidebar's
// mount effect, useStorageUsage, the project page's account-switch check) -
// hits NextAuth's /api/auth/session under the hood.
export async function resolveSession(): Promise<GuardSession | null> {
  const session = await getSession()
  return toGuardSession(session)
}

// For pages that require a session: callers must wait for `ready` before
// doing anything auth-dependent, so no page can redirect off a too-early
// read. `ready` mirrors the old contract exactly - true only once a session
// is confirmed present, never true while redirecting away.
export function useSessionGuard() {
  const router = useRouter()
  const { data, status } = useSession()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login')
  }, [status, router])

  return {
    session: status === 'authenticated' ? toGuardSession(data) : null,
    ready: status === 'authenticated',
  }
}

// The mirror image, for pages that should skip straight past their own
// logged-out content when a session already exists (e.g. the marketing
// landing page): redirects to `destination` if a session is found, and
// otherwise does nothing at all - no ready/loading state, since the
// logged-out case (the common case here) should render immediately with
// no flash or wait on this check.
export function useRedirectIfAuthenticated(destination: string) {
  const router = useRouter()
  const { status } = useSession()

  useEffect(() => {
    if (status === 'authenticated') router.replace(destination)
  }, [status, router, destination])
}
