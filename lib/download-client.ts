// Browser half of Download: ask the server for a download URL (it does the
// access checks), then hand that URL to the browser. The URL itself is never
// built client-side.

async function readUrl(res: Response): Promise<string> {
  const body = await res.json().catch(() => null)
  if (!res.ok || typeof body?.url !== 'string') {
    throw new Error(typeof body?.error === 'string' ? body.error : 'Download failed')
  }
  return body.url
}

export async function fetchAssetDownloadUrl(assetId: string): Promise<string> {
  return readUrl(await fetch(`/api/assets/${assetId}/download`))
}

export async function fetchShareDownloadUrl(token: string, assetId: string, password?: string): Promise<string> {
  return readUrl(await fetch('/api/share/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, asset_id: assetId, password }),
  }))
}

// The URL answers with Content-Disposition: attachment, so following it
// saves the file without leaving the page.
export function startBrowserDownload(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
