import { useEffect, useState } from 'react'
import { resolveSession } from './useSessionGuard'

// Fetches the current user's own total upload size (Custom Cut + Board Cut
// + Raw Footage) from /api/storage-usage. Returns null while loading/on
// failure so callers can render a neutral state instead of "0 GB used".
export function useStorageUsage() {
  const [usedBytes, setUsedBytes] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    resolveSession().then(async (session) => {
      if (!session) { if (!cancelled) setLoading(false); return }
      try {
        const res = await fetch('/api/storage-usage', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setUsedBytes(data.used_bytes ?? 0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [])

  return { usedBytes, loading }
}
