import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/api-auth'

// Sums size_bytes across every asset (Custom Cut + Board Cut - cut_type
// isn't filtered, so both count) plus file_size_bytes across every raw
// footage upload.
//
// If the caller belongs to a workspace that's been assigned an agency plan
// tier (workspaces.workspace_plan_id), usage is pooled across every project
// in that workspace instead of scoped to their own uploads - agency tiers
// bill storage at the workspace level, not per editor. Everyone else keeps
// the existing per-user ("my own uploads") scoping. Read-only - never
// touches upload logic or the underlying columns.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { data: memberships } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id, workspaces(id, name, workspace_plan_id, workspace_plans(id, name, storage_gb, max_admins, max_editors))')
    .eq('user_id', user.id)

  const agencyMembership = (memberships ?? []).find((m) => {
    const workspace = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces
    return !!workspace?.workspace_plan_id
  })

  if (agencyMembership) {
    const workspace = Array.isArray(agencyMembership.workspaces) ? agencyMembership.workspaces[0] : agencyMembership.workspaces
    const planRaw = workspace?.workspace_plans
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw

    const { data: projects, error: projectsError } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('workspace_id', agencyMembership.workspace_id)

    if (projectsError) return NextResponse.json({ error: projectsError.message }, { status: 500 })

    const projectIds = (projects ?? []).map((p) => p.id)

    const [assetsResult, rawFilesResult] = projectIds.length
      ? await Promise.all([
          supabaseAdmin.from('assets').select('size_bytes').in('project_id', projectIds),
          supabaseAdmin.from('raw_files').select('file_size_bytes').in('project_id', projectIds),
        ])
      : [{ data: [] as { size_bytes: number | null }[], error: null }, { data: [] as { file_size_bytes: number | null }[], error: null }] as const

    if (assetsResult.error) return NextResponse.json({ error: assetsResult.error.message }, { status: 500 })
    if (rawFilesResult.error) return NextResponse.json({ error: rawFilesResult.error.message }, { status: 500 })

    const assetsTotal = (assetsResult.data ?? []).reduce((sum, a) => sum + (a.size_bytes ?? 0), 0)
    const rawFilesTotal = (rawFilesResult.data ?? []).reduce((sum, f) => sum + (f.file_size_bytes ?? 0), 0)

    return NextResponse.json({
      used_bytes: assetsTotal + rawFilesTotal,
      workspace_plan: plan
        ? { id: plan.id, name: plan.name, storage_gb: plan.storage_gb, max_admins: plan.max_admins, max_editors: plan.max_editors }
        : null,
    })
  }

  const [assetsResult, rawFilesResult] = await Promise.all([
    supabaseAdmin.from('assets').select('size_bytes').eq('uploaded_by', user.id),
    supabaseAdmin.from('raw_files').select('file_size_bytes').eq('uploaded_by', user.id),
  ])

  if (assetsResult.error) return NextResponse.json({ error: assetsResult.error.message }, { status: 500 })
  if (rawFilesResult.error) return NextResponse.json({ error: rawFilesResult.error.message }, { status: 500 })

  const assetsTotal = (assetsResult.data ?? []).reduce((sum, a) => sum + (a.size_bytes ?? 0), 0)
  const rawFilesTotal = (rawFilesResult.data ?? []).reduce((sum, f) => sum + (f.file_size_bytes ?? 0), 0)

  return NextResponse.json({ used_bytes: assetsTotal + rawFilesTotal, workspace_plan: null })
}
