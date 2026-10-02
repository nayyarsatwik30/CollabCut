import { NextRequest, NextResponse } from 'next/server'
import { verifyShareDownloadAccess } from '@/lib/share-access'
import { resolveAssetDownload } from '@/lib/download'

// Public, unauthenticated download for /r/[token]. POST (not GET) so the
// share password travels in the body instead of a URL that gets logged.
// Everything is re-verified here on every request - token, expiry, password,
// lineage membership - and, unlike comments, the link must also allow
// downloads: the page hiding the button is not enforcement.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const token = body?.token
  const assetId = body?.asset_id
  const password = typeof body?.password === 'string' ? body.password : null

  if (typeof token !== 'string' || typeof assetId !== 'string' || !token || !assetId) {
    return NextResponse.json({ error: 'token and asset_id required' }, { status: 400 })
  }

  const access = await verifyShareDownloadAccess(assetId, token, password)
  if (access === 'invalid') return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  if (access === 'disabled') return NextResponse.json({ error: 'Downloads are disabled for this link' }, { status: 403 })

  const resolved = await resolveAssetDownload(assetId)
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status })

  return NextResponse.json({ url: resolved.url }, { headers: { 'Cache-Control': 'no-store' } })
}
