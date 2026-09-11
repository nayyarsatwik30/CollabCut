import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/api-auth'
import { attachCoverPlaybackIds } from '@/lib/project-covers'

// Projects an editor can reach even with no workspace-admin role - a project
// counts as theirs if they hold at least one asset_editors assignment in it,
// same rule GET /api/projects/[id] already uses to authorize the page this
// list links into.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { data: assignedRows, error: assignedError } = await supabaseAdmin
    .from('asset_editors')
    .select('assets!inner(project_id, deleted_at)')
    .eq('editor_id', user.id)
    .is('assets.deleted_at', null)

  if (assignedError) return NextResponse.json({ error: assignedError.message }, { status: 500 })

  const projectIds = Array.from(new Set(
    (assignedRows ?? [])
      .map((row: any) => (Array.isArray(row.assets) ? row.assets[0] : row.assets)?.project_id)
      .filter(Boolean)
  ))

  if (projectIds.length === 0) return NextResponse.json({ projects: [] })

  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .in('id', projectIds)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const projects = await attachCoverPlaybackIds(supabaseAdmin, data ?? [])
  return NextResponse.json({ projects })
}
