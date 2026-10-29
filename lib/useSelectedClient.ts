'use client'

import { useCallback, useEffect, useState } from 'react'
import { ALL_CLIENTS_KEY, NO_CLIENT_KEY, clientKey } from '@/lib/clients'

// Shared by the Board and /dashboard Projects pages so the chosen client tab
// survives navigation between them.
//  - selected client: sessionStorage, per workspace (survives navigation and
//    reload within the session; a new session starts on "All clients").
//  - client names added with "+" before any project uses them: localStorage,
//    per workspace, this browser only (there is no clients table; see PR).
const selKey = (ws: string) => `collabcut:selected-client:${ws}`
const extraKey = (ws: string) => `collabcut:client-tabs:${ws}`

export function useSelectedClient(workspaceId: string) {
  const [selectedClient, setSelectedClientState] = useState<string>(ALL_CLIENTS_KEY)
  const [extraClients, setExtraClients] = useState<string[]>([])

  useEffect(() => {
    if (!workspaceId) return
    try {
      setSelectedClientState(sessionStorage.getItem(selKey(workspaceId)) || ALL_CLIENTS_KEY)
    } catch {
      setSelectedClientState(ALL_CLIENTS_KEY)
    }
    try {
      const parsed = JSON.parse(localStorage.getItem(extraKey(workspaceId)) ?? '[]')
      setExtraClients(Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string').slice(0, 100) : [])
    } catch {
      setExtraClients([])
    }
  }, [workspaceId])

  const setSelectedClient = useCallback((key: string) => {
    setSelectedClientState(key)
    if (!workspaceId) return
    try {
      if (key === ALL_CLIENTS_KEY) sessionStorage.removeItem(selKey(workspaceId))
      else sessionStorage.setItem(selKey(workspaceId), key)
    } catch { /* storage unavailable: selection lasts for this page only */ }
  }, [workspaceId])

  // Returns an error message, or null on success. Adding a name whose key
  // already exists just selects that tab.
  const addClient = useCallback((raw: string, existingKeys: string[]): string | null => {
    const name = raw.trim().replace(/\s+/g, ' ')
    if (!name) return 'Enter a client name'
    if (name.length > 100) return 'Max 100 characters'
    const key = clientKey(name)
    if (key === NO_CLIENT_KEY) return 'Enter a client name'
    if (!existingKeys.includes(key)) {
      const next = [...extraClients, name]
      setExtraClients(next)
      try { if (workspaceId) localStorage.setItem(extraKey(workspaceId), JSON.stringify(next)) } catch { /* session-only */ }
    }
    setSelectedClient(key)
    return null
  }, [extraClients, workspaceId, setSelectedClient])

  return { selectedClient, setSelectedClient, extraClients, addClient }
}
