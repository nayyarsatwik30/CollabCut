import { migrationDb } from '@/lib/migrationDb'

// A project's cover is pinned to the first asset (any cut_type) that ever
// finished Mux processing in it - the pin is set once, in the Mux webhook
// (app/api/webhooks/mux/route.ts), and never overwritten by later uploads.
// This only recomputes a pin when the asset it points to has since been
// soft-deleted (falls back to the next-earliest survivor), and lazily
// backfills projects that predate these columns. Shared by every endpoint
// that returns project-card data, so the cover logic lives in exactly one
// place.
export async function attachCoverPlaybackIds<
  T extends { id: string; cover_asset_id?: string | null }
>(
  projects: T[],
): Promise<(T & { cover_playback_id: string | null })[]> {
  const pinnedIds = projects
    .map((p) => p.cover_asset_id)
    .filter((id): id is string => !!id)

  // A pin is only trustworthy if the asset it points to still exists,
  // isn't soft-deleted, and has a playback id - re-validate every pin
  // currently on these projects in one query.
  const validPinned: Record<string, string> = {}
  if (pinnedIds.length > 0) {
    const pinnedAssets = await migrationDb.query(
      `SELECT id, mux_playback_id, deleted_at FROM assets WHERE id = ANY($1)`,
      [pinnedIds]
    )

    for (const a of pinnedAssets.rows) {
      if (!a.deleted_at && a.mux_playback_id) validPinned[a.id] = a.mux_playback_id
    }
  }

  // Projects with no pin yet, or whose pin just failed validation above.
  const needsPin = projects.filter((p) => !p.cover_asset_id || !validPinned[p.cover_asset_id])

  const earliestByProject: Record<string, { id: string; mux_playback_id: string }> = {}
  if (needsPin.length > 0) {
    const candidates = await migrationDb.query(
      `SELECT id, project_id, mux_playback_id, created_at FROM assets
       WHERE project_id = ANY($1) AND deleted_at IS NULL AND mux_playback_id IS NOT NULL
       ORDER BY created_at ASC`,
      [needsPin.map((p) => p.id)]
    )

    for (const a of candidates.rows) {
      if (!earliestByProject[a.project_id]) {
        earliestByProject[a.project_id] = { id: a.id, mux_playback_id: a.mux_playback_id }
      }
    }

    // Persist each (re-)pin so this recompute only ever has to happen once
    // per project. Guarded on the project's prior cover_asset_id value so
    // this never clobbers a pin set concurrently (by the webhook, or by
    // another request racing this same recompute).
    await Promise.all(
      needsPin.map((p) => {
        const pin = earliestByProject[p.id]
        if (!pin) return null
        return p.cover_asset_id
          ? migrationDb.query(
              `UPDATE projects SET cover_asset_id = $1, cover_playback_id = $2 WHERE id = $3 AND cover_asset_id = $4`,
              [pin.id, pin.mux_playback_id, p.id, p.cover_asset_id]
            )
          : migrationDb.query(
              `UPDATE projects SET cover_asset_id = $1, cover_playback_id = $2 WHERE id = $3 AND cover_asset_id IS NULL`,
              [pin.id, pin.mux_playback_id, p.id]
            )
      })
    )
  }

  return projects.map((p) => {
    if (p.cover_asset_id && validPinned[p.cover_asset_id]) {
      return { ...p, cover_playback_id: validPinned[p.cover_asset_id] }
    }
    const pin = earliestByProject[p.id]
    return { ...p, cover_playback_id: pin ? pin.mux_playback_id : null }
  })
}
