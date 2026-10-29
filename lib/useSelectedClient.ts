'use client'

import { useCallback, useEffect, useState } from 'react'
import { ALL_CLIENTS_KEY, NO_CLIENT_KEY, clientKey } from '@/lib/clients'

const MAX_NAME = 100
const MAX_EXTRAS = 100

function readExtras(ws: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(extraKey(ws)) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((n): n is string => typeof n === 'string').map((n) => n.slice(0, MAX_NAME)).slice(0, MAX_EXTRAS)
      : []
  } catch {
    return []
  }
}

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
  // Which workspace the state above was restored for; consumers must not act
  // on selectedClient (e.g. reset it) until this matches their workspaceId.
  const [hydratedFor, setHydratedFor] = useState('')

  useEffect(() => {
    if (!workspaceId) return
    try {
      setSelectedClientState(sessionStorage.getItem(selKey(workspaceId)) || ALL_CLIENTS_KEY)
    } catch {
      setSelectedClientState(ALL_CLIENTS_KEY)
    }
    setExtraClients(readExtras(workspaceId))
    setHydratedFor(workspaceId)
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
    if (name.length > MAX_NAME) return 'Max 100 characters'
    // "No client" (any case/spacing) means the existing no-client bucket.
    if (name.toLowerCase() === 'no client') {
      if (!existingKeys.includes(NO_CLIENT_KEY)) return 'No projects without a client yet'
      setSelectedClient(NO_CLIENT_KEY)
      return null
    }
    const key = clientKey(name)
    if (!existingKeys.includes(key)) {
      // Re-read so a second browser tab's additions aren't overwritten.
      const current = readExtras(workspaceId)
      const next = current.some((n) => clientKey(n) === key) ? current : [...current, name].slice(-MAX_EXTRAS)
      setExtraClients(next)
      try { if (workspaceId) localStorage.setItem(extraKey(workspaceId), JSON.stringify(next)) } catch { /* session-only */ }
    }
    setSelectedClient(key)
    return null
  }, [workspaceId, setSelectedClient])

  return { selectedClient, setSelectedClient, extraClients, addClient, hydrated: !!workspaceId && hydratedFor === workspaceId }
}
