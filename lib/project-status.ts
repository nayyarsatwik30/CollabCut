import { supabaseAdmin } from '@/lib/supabase-admin'

// Recomputes a project's status from its assets' pipeline_status and writes
// it back, so projects.status (the dashboard badge) never has to be set
// directly by a single-asset action again.
export async function syncProjectStatus(projectId: string) {
  // Custom Cuts don't go through pipeline_status/review at all, so they're
  // excluded here - otherwise a project could never read as "approved"
  // while it still had an untouched Custom Cut sitting at the default status.
  const { data: assets } = await supabaseAdmin
    .from('assets')
    .select('id, version, asset_group_id, pipeline_status')
    .eq('project_id', projectId)
    .eq('cut_type', 'board')
    .is('deleted_at', null)

  if (!assets || assets.length === 0) return

  const latestByGroup = new Map<string, (typeof assets)[number]>()
  for (const asset of assets) {
    const key = asset.asset_group_id ?? asset.id
    const existing = latestByGroup.get(key)
    if (!existing || asset.version > existing.version) {
      latestByGroup.set(key, asset)
    }
  }
  const latest = Array.from(latestByGroup.values())

  const status = latest.every((a) => a.pipeline_status === 'approved')
    ? 'approved'
    : latest.some((a) => a.pipeline_status === 'revision')
    ? 'changes'
    : 'in_review'

  await supabaseAdmin.from('projects').update({ status }).eq('id', projectId)
}
