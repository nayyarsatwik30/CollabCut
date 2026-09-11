import type { SupabaseClient } from '@supabase/supabase-js'

// Most recently created Board Cut asset per project that actually has a Mux
// thumbnail - mux_playback_id is only ever set once a real upload finishes
// processing, so this already excludes placeholders and still-processing
// assets without a separate check. Shared by every endpoint that returns
// project-card data, so the cover logic lives in exactly one place.
export async function attachCoverPlaybackIds<T extends { id: string }>(
  supabaseAdmin: SupabaseClient,
  projects: T[],
): Promise<(T & { cover_playback_id: string | null })[]> {
  const projectIds = projects.map((p) => p.id)
  const coverByProject: Record<string, string> = {}

  if (projectIds.length > 0) {
    const { data: coverAssets } = await supabaseAdmin
      .from('assets')
      .select('project_id, mux_playback_id')
      .in('project_id', projectIds)
      .eq('cut_type', 'board')
      .is('deleted_at', null)
      .not('mux_playback_id', 'is', null)
      .order('created_at', { ascending: false })

    for (const a of coverAssets ?? []) {
      if (!coverByProject[a.project_id]) coverByProject[a.project_id] = a.mux_playback_id
    }
  }

  return projects.map((p) => ({ ...p, cover_playback_id: coverByProject[p.id] ?? null }))
}
