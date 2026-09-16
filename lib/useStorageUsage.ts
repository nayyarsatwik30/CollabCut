import { useEffect, useState } from 'react'
import { resolveSession } from './useSessionGuard'

export interface WorkspaceStoragePlan {
  id: string
  name: string
  storage_gb: number
  max_admins: number
  max_editors: number
}

// Fetches the current user's storage usage from /api/storage-usage - their
// own uploads (Custom Cut + Board Cut + Raw Footage), or the pooled total
// for their agency-tier workspace when they belong to one (see
// workspace_plan in the response). Returns null while loading/on failure so
// callers can render a neutral state instead of "0 GB used".
export function useStorageUsage() {
  const [usedBytes, setUsedBytes] = useState<number | null>(null)
  const [workspacePlan, setWorkspacePlan] = useState<WorkspaceStoragePlan | null>(null)
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
          if (!cancelled) {
            setUsedBytes(data.used_bytes ?? 0)
            setWorkspacePlan(data.workspace_plan ?? null)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [])

  return { usedBytes, workspacePlan, loading }
}
