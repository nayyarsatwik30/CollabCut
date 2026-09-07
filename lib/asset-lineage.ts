// Keep only the highest-version row per logical video, so a board-style
// listing shows one card per asset lineage instead of one per version.
// Shared by /api/board and anywhere else that needs the same per-lineage
// collapsing (e.g. an admin looking up one editor's assets).
export function latestPerGroup<T extends { asset_group_id: string | null; id: string; version: number }>(rows: T[]): T[] {
  const latestByGroup = new Map<string, T>()
  for (const row of rows) {
    const key = row.asset_group_id ?? row.id
    const existing = latestByGroup.get(key)
    if (!existing || row.version > existing.version) {
      latestByGroup.set(key, row)
    }
  }
  return Array.from(latestByGroup.values())
}
