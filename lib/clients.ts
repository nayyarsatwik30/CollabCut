// A "client" on CollabCut is the agency's customer (e.g. "Kunal"). It is NOT a
// workspace: a workspace is the agency tenant that owns the editors, plan and
// data isolation. Clients are the existing free-text `projects.client` label
// inside one workspace, so every client board is just a filter over that
// workspace's own projects/assets. No separate table, no extra access path.

// Special keys contain no 'c:' prefix, so they can never collide with a client
// whose label happens to read '__all__' / '__none__'.
export const ALL_CLIENTS_KEY = '__all__'
export const NO_CLIENT_KEY = '__none__'

export interface ClientTab {
  key: string // stable identifier: "c:" + normalized client name, or NO_CLIENT_KEY
  label: string // display name (first-seen casing)
  count: number
}

// Case/whitespace-insensitive identity so "Kunal" and " kunal " share a board.
export function clientKey(client: string | null | undefined): string {
  const normalized = (client ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  return normalized === '' ? NO_CLIENT_KEY : `c:${normalized}`
}

export function buildClientTabs(items: { client: string | null | undefined }[]): ClientTab[] {
  const map = new Map<string, ClientTab>()
  for (const item of items) {
    const key = clientKey(item.client)
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
    } else {
      const label = key === NO_CLIENT_KEY ? 'No client' : (item.client ?? '').trim().replace(/\s+/g, ' ')
      map.set(key, { key, label, count: 1 })
    }
  }
  const tabs = Array.from(map.values())
  // Named clients A-Z, "No client" last.
  tabs.sort((a, b) => {
    if (a.key === NO_CLIENT_KEY) return 1
    if (b.key === NO_CLIENT_KEY) return -1
    return a.label.localeCompare(b.label)
  })
  return tabs
}

export function matchesClient(client: string | null | undefined, selectedKey: string): boolean {
  return selectedKey === ALL_CLIENTS_KEY || clientKey(client) === selectedKey
}

// Named clients A-Z, "No client" last.
export function sortClientTabs(tabs: ClientTab[]): ClientTab[] {
  return [...tabs].sort((a, b) => {
    if (a.key === NO_CLIENT_KEY) return 1
    if (b.key === NO_CLIENT_KEY) return -1
    return a.label.localeCompare(b.label)
  })
}

// Appends locally-saved client names that no server-side data uses yet
// (count 0), skipping any whose key already has a tab.
export function mergeExtraClients(tabs: ClientTab[], extras: string[]): ClientTab[] {
  const out = [...tabs]
  const known = new Set(out.map((t) => t.key))
  for (const name of extras) {
    const key = clientKey(name)
    if (key === NO_CLIENT_KEY || known.has(key)) continue
    out.push({ key, label: name, count: 0 })
    known.add(key)
  }
  return sortClientTabs(out)
}

// "1 card" / "2 cards", "1 project" / "0 projects".
export function countLabel(n: number, unit: 'cards' | 'projects'): string {
  return `${n} ${n === 1 ? unit.slice(0, -1) : unit}`
}
