import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/api-auth'

// Sums size_bytes across every asset (Custom Cut + Board Cut - cut_type
// isn't filtered, so both count) plus file_size_bytes across every raw
// footage upload, scoped to the authenticated user's own uploads only.
// Read-only - never touches upload logic or the underlying columns.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const [assetsResult, rawFilesResult] = await Promise.all([
    supabaseAdmin.from('assets').select('size_bytes').eq('uploaded_by', user.id),
    supabaseAdmin.from('raw_files').select('file_size_bytes').eq('uploaded_by', user.id),
  ])

  if (assetsResult.error) return NextResponse.json({ error: assetsResult.error.message }, { status: 500 })
  if (rawFilesResult.error) return NextResponse.json({ error: rawFilesResult.error.message }, { status: 500 })

  const assetsTotal = (assetsResult.data ?? []).reduce((sum, a) => sum + (a.size_bytes ?? 0), 0)
  const rawFilesTotal = (rawFilesResult.data ?? []).reduce((sum, f) => sum + (f.file_size_bytes ?? 0), 0)

  return NextResponse.json({ used_bytes: assetsTotal + rawFilesTotal })
}
