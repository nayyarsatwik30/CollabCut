import { migrationDb } from './migrationDb'
import { buildDownloadFilename } from './utils'

export type DownloadResolution =
  | { ok: true; url: string; filename: string }
  | { ok: false; status: number; error: string }

// Server-side half of Download, shared by the review route and the share
// route. Callers MUST have authorized the request first - this only
// resolves what to serve for an asset the caller is already allowed to get.
//
// Today that is Mux's capped-1080p static rendition (the only file that
// exists for assets uploaded before new uploads stopped requesting
// mp4_support). The filename is built here from the DB, never taken from the
// client. New assets have no rendition, so a HEAD against the public URL
// answers "is there actually a file" without needing the Mux API.
export async function resolveAssetDownload(assetId: string): Promise<DownloadResolution> {
  const result = await migrationDb.query(
    `SELECT a.name, a.version, a.mux_playback_id, a.deleted_at,
            p.name AS project_name, p.deleted_at AS project_deleted_at
     FROM assets a LEFT JOIN projects p ON p.id = a.project_id
     WHERE a.id = $1`,
    [assetId]
  )
  const asset = result.rows[0]
  if (!asset || asset.deleted_at || asset.project_deleted_at) {
    return { ok: false, status: 404, error: 'Not found' }
  }
  if (!asset.mux_playback_id) {
    return { ok: false, status: 409, error: 'This video is still processing' }
  }

  const fileUrl = `https://stream.mux.com/${asset.mux_playback_id}/capped-1080p.mp4`
  try {
    const head = await fetch(fileUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
    if (head.status === 404 || head.status === 403) {
      return { ok: false, status: 404, error: 'No downloadable file is available for this video yet' }
    }
    if (!head.ok) return { ok: false, status: 502, error: 'Could not prepare the download. Please try again.' }
  } catch {
    return { ok: false, status: 502, error: 'Could not prepare the download. Please try again.' }
  }

  const filename = buildDownloadFilename(asset.project_name, asset.name, asset.version)
  return { ok: true, url: `${fileUrl}?download=${encodeURIComponent(filename)}`, filename }
}
