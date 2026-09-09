'use client'

import { useEffect, useRef } from 'react'
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
  // The user id this tab last knew about, so a routine token refresh or the
  // visibility-triggered re-notification for the SAME user (both fire as
  // SIGNED_IN/TOKEN_REFRESHED even when nothing actually changed) can be
  // told apart from a genuine account switch.
  const knownUserId = useRef<string | null>(null)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user.id ?? null

      if (event === 'INITIAL_SESSION') {
        // Fires once with whatever session this tab already had when it
        // subscribed - just the baseline, not a change.
        knownUserId.current = newUserId
        return
      }

      if (event === 'SIGNED_OUT') {
        knownUserId.current = null
        router.push('/auth/login')
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const userChanged = newUserId !== knownUserId.current
        knownUserId.current = newUserId

        // Same user: a routine token refresh, or the visibility-driven
        // session recovery that re-fires SIGNED_IN for an unchanged session
        // when a backgrounded tab regains focus. Must not reload - that
        // used to kill in-progress work (e.g. a video upload) just because
        // the tab was switched away from and back.
        if (!userChanged) return

        const path = window.location.pathname
        // The login/signup/invite flows already navigate themselves right
        // after their own sign-in call - skip so we don't fight that
        // navigation or force a jarring reload on the tab that's doing the
        // signing in. Everywhere else, a real user-id change means another
        // tab switched accounts, so reload to pick it up.
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
