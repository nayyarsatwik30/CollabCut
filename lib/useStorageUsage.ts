import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export interface WorkspaceStoragePlan {
  id: string
  name: string
  storage_gb: number
  max_admins: number
  max_editors: number
}

interface StorageUsageData {
  usedBytes: number
  workspacePlan: WorkspaceStoragePlan | null
}

// Sidebar and the settings page both mount this hook at the same time, and
// both want the same /api/storage-usage response for the signed-in user.
// This module-level cache + in-flight promise means the second instance to
// mount reuses the first instance's request/result instead of firing its
// own - cleared on sign-out so a different user's data is never served
// from a stale cache.
let cachedData: StorageUsageData | null = null
let inFlight: Promise<StorageUsageData | null> | null = null
const subscribers = new Set<(data: StorageUsageData) => void>()

function fetchStorageUsage(): Promise<StorageUsageData | null> {
  if (!inFlight) {
    inFlight = fetch('/api/storage-usage')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const result = data ? { usedBytes: data.used_bytes ?? 0, workspacePlan: data.workspace_plan ?? null } : null
        cachedData = result
        if (result) subscribers.forEach((notify) => notify(result))
        return result
      })
      .finally(() => { inFlight = null })
  }
  return inFlight
}

// Drops the cached usage and refetches it for every mounted
// useStorageUsage() - call after anything that changes the user's stored
// bytes (an upload), otherwise the bar keeps showing the first value it
// ever loaded until a full page reload.
export function invalidateStorageUsage() {
  cachedData = null
  if (subscribers.size > 0) fetchStorageUsage()
}

// Fetches the current user's storage usage from /api/storage-usage - their
// own uploads (Custom Cut + Board Cut + Raw Footage), or the pooled total
// for their agency-tier workspace when they belong to one (see
// workspace_plan in the response). Returns null while loading/on failure so
// callers can render a neutral state instead of "0 GB used".
export function useStorageUsage() {
  const { status } = useSession()
  const [usedBytes, setUsedBytes] = useState<number | null>(cachedData?.usedBytes ?? null)
  const [workspacePlan, setWorkspacePlan] = useState<WorkspaceStoragePlan | null>(cachedData?.workspacePlan ?? null)
  const [loading, setLoading] = useState(!cachedData)

  useEffect(() => {
    const notify = (data: StorageUsageData) => {
      setUsedBytes(data.usedBytes)
      setWorkspacePlan(data.workspacePlan)
    }
    subscribers.add(notify)
    return () => { subscribers.delete(notify) }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      cachedData = null
      setLoading(false)
      return
    }
    if (status !== 'authenticated') return
    if (cachedData) {
      setUsedBytes(cachedData.usedBytes)
      setWorkspacePlan(cachedData.workspacePlan)
      setLoading(false)
      return
    }

    let cancelled = false
    fetchStorageUsage().then((data) => {
      if (cancelled) return
      if (data) {
        setUsedBytes(data.usedBytes)
        setWorkspacePlan(data.workspacePlan)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [status])

  return { usedBytes, workspacePlan, loading }
}
