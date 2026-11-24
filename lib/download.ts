import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { b2, B2_BUCKET } from './b2'
import { originalExtension } from './asset-original'
import { migrationDb } from './migrationDb'
import { buildDownloadFilename } from './utils'

const ORIGINAL_URL_TTL_SECONDS = 10 * 60

// Both forms so every browser saves the exact name, non-ASCII letters included.
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`
}

export type DownloadResolution =
  | { ok: true; url: string; filename: string }
  | { ok: false; status: number; error: string }

// Server-side half of Download, shared by the review route and the share
// route. Callers MUST have authorized the request first - this only
// resolves what to serve for an asset the caller is already allowed to get.
//
// Serves the exact file that was uploaded (a short-lived presigned B2 URL)
// when the asset has one, otherwise - assets uploaded before originals were
// kept - Mux's capped-1080p re-encoded rendition. The filename is built here
// from the DB, never taken from the client. A HEAD against the rendition's
// public URL answers "is there actually a file" without needing the Mux API.
export async function resolveAssetDownload(assetId: string): Promise<DownloadResolution> {
  const result = await migrationDb.query(
    `SELECT a.name, a.version, a.mux_playback_id, a.deleted_at,
            a.original_b2_key, a.original_file_name, a.original_content_type,
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

  if (asset.original_b2_key) {
    const filename = buildDownloadFilename(
      asset.project_name, asset.name, asset.version, originalExtension(asset.original_file_name),
    )
    try {
      const url = await getSignedUrl(
        b2,
        new GetObjectCommand({
          Bucket: B2_BUCKET,
          Key: asset.original_b2_key,
          ResponseContentDisposition: contentDisposition(filename),
          ...(asset.original_content_type ? { ResponseContentType: asset.original_content_type } : {}),
        }),
        { expiresIn: ORIGINAL_URL_TTL_SECONDS },
      )
      return { ok: true, url, filename }
    } catch (err) {
      console.error('original download presign failed', (err as Error).name)
      return { ok: false, status: 502, error: 'Could not prepare the download. Please try again.' }
    }
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
