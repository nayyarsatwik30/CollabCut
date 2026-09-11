import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Cold-start login flash: on a fresh (uncached) page load, a page's very
// first getSession() call has been seen to come back with no session, then
// resolve fine on an instant retry. Rather than trusting a single read as
// gospel, this pauses briefly and checks once more before deciding there's
// really no session - and callers must wait for `ready` before doing
// anything auth-dependent, so no page can redirect off a too-early read.
export function useSessionGuard() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const settle = (s: Session) => {
      if (cancelled) return
      setSession(s)
      setReady(true)
    }

    const check = async () => {
      const { data: { session: first } } = await supabase.auth.getSession()
      if (first) { settle(first); return }

      // First read found nothing - give a slow cold start one more chance
      // before treating that as a confirmed "logged out".
      await new Promise((resolve) => setTimeout(resolve, 300))
      if (cancelled) return

      const { data: { session: second } } = await supabase.auth.getSession()
      if (second) { settle(second); return }

      if (!cancelled) router.push('/auth/login')
    }

    check()
    return () => { cancelled = true }
  }, [router])

  return { session, ready }
}
