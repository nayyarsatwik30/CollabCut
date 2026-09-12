import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { data, error } = await supabaseAdmin
    .from('asset_editors')
    .select('assets(id, name, status, is_complete, deleted_at, mux_playback_id, projects(id, name))')
    .eq('editor_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const assets = (data ?? [])
    .map((row: any) => (Array.isArray(row.assets) ? row.assets[0] : row.assets))
    .filter((asset: any) => asset && !asset.deleted_at)
    .map((asset: any) => {
      const project = Array.isArray(asset.projects) ? asset.projects[0] : asset.projects
      return {
        id: asset.id,
        name: asset.name,
        status: asset.status,
        is_complete: asset.is_complete,
        mux_playback_id: asset.mux_playback_id ?? null,
        project_id: project?.id ?? null,
        project_name: project?.name ?? 'Untitled project',
      }
    })

  return NextResponse.json({ assets })
}
