'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Supabase persists the session to one shared localStorage slot, so a
// sign-in/out in one tab silently becomes the "current" session for every
// other tab too (via its cross-tab BroadcastChannel, or on focus). But no
// page re-fetches when that happens — each one only reads the session once,
// on mount — so a tab just keeps rendering whichever account's data it
// already loaded. This listener is the one place that reacts to those
// out-of-band changes so a tab never gets stuck showing a stale account.
export function SessionSync() {
  const router = useRouter()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Fires once with whatever session this tab already had when it
      // subscribed - not a change, so it must not trigger a reload/redirect.
      if (event === 'INITIAL_SESSION') return

      if (event === 'SIGNED_OUT') {
        router.push('/auth/login')
        return
      }

      if (event === 'SIGNED_IN') {
        const path = window.location.pathname
        // The login/signup/invite flows already navigate themselves right
        // after their own sign-in call - skip so we don't fight that
        // navigation or force a jarring reload on the tab that's doing the
        // signing in. Everywhere else, a SIGNED_IN we didn't cause here
        // means another tab switched accounts, so reload to pick it up.
        const isAuthFlowPage = path.startsWith('/auth/') || path.startsWith('/invite/')
        if (!isAuthFlowPage) {
          window.location.reload()
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return null
}
