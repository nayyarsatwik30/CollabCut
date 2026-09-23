import { useEffect, useRef } from 'react'

// Lightweight stand-in for realtime: re-runs `fn` every `intervalMs` while
// the calling component is mounted AND the tab is actually visible. Uses a
// setTimeout chain rather than setInterval so a slow response can never
// stack overlapping requests, and pauses entirely on hidden tabs (firing
// once immediately when the tab comes back) - keep intervals at 5-8s, we
// already shipped one duplicate-API-calls bug from over-chatty polling.
export function usePolling(fn: () => Promise<void> | void, intervalMs: number, enabled = true) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = () => {
      clearTimeout(timer)
      if (cancelled || document.visibilityState !== 'visible') return
      timer = setTimeout(tick, intervalMs)
    }

    const tick = async () => {
      if (cancelled) return
      try {
        await fnRef.current()
      } catch {
        // transient failure - just try again next cycle
      }
      schedule()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
      else clearTimeout(timer)
    }

    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, enabled])
}

// Cheap structural equality for API payloads - lets a poll skip setState
// (and therefore any re-render) when nothing actually changed.
export function sameData(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}
