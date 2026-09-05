import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('asset_editors')
    .select('assets(id, name, status, is_complete, deleted_at, projects(id, name))')
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
        project_id: project?.id ?? null,
        project_name: project?.name ?? 'Untitled project',
      }
    })

  return NextResponse.json({ assets })
}
