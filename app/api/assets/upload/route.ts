import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { video } from '@/lib/mux'
import { syncProjectStatus } from '@/lib/project-status'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { project_id, name, linked_asset_name, cut_type } = await req.json()
  if (!project_id || !name) {
    return NextResponse.json({ error: 'project_id and name required' }, { status: 400 })
  }
  if (cut_type && cut_type !== 'custom' && cut_type !== 'board') {
    return NextResponse.json({ error: 'Invalid cut_type' }, { status: 400 })
  }

  // Custom Cuts have no versioning concept at all, so the auto-stacking lookup
  // below only ever runs for a Board Cut. Two branches:
  //  - linked_asset_name present: a real "new version" upload (review screen).
  //    Matched by name only - cut_type isn't known yet, that's exactly what
  //    this lookup is for, so it can't be used to filter it.
  //  - no linked_asset_name, requested type is 'board': a first-time upload
  //    that happens to share a filename with an existing Board Cut auto-stacks
  //    onto it, same as before. Requested type 'custom' skips this entirely -
  //    every Custom Cut upload is always its own independent asset.
  let linkedHead: { id: string; version: number; asset_group_id: string | null; cut_type: string } | null = null

  if (linked_asset_name) {
    const { data: existing } = await supabaseAdmin
      .from('assets')
      .select('id, version, asset_group_id, cut_type')
      .eq('project_id', project_id)
      .eq('name', linked_asset_name)
      .order('version', { ascending: false })
      .limit(1)
    linkedHead = existing?.[0] ?? null
  } else if ((cut_type ?? 'board') === 'board') {
    const { data: existing } = await supabaseAdmin
      .from('assets')
      .select('id, version, asset_group_id, cut_type')
      .eq('project_id', project_id)
      .eq('name', name)
      .eq('cut_type', 'board')
      .order('version', { ascending: false })
      .limit(1)
    linkedHead = existing?.[0] ?? null
  }

  // A version upload always inherits its lineage's real cut_type - never
  // whatever the client sent - so a Custom Cut asset can't be flipped to
  // 'board' (or vice versa) by an "Upload new version" request.
  const cutType = linkedHead ? linkedHead.cut_type : (cut_type ?? 'board')
  const nextVersion = linkedHead ? linkedHead.version + 1 : 1

  const upload = await video.uploads.create({
    cors_origin: process.env.NEXT_PUBLIC_APP_URL!,
    new_asset_settings: {
      playback_policy: ['public'],
      mp4_support: 'capped-1080p',
    },
  })

  // asset_group_id ties every version of the same logical video together,
  // independent of filename: reuse the linked asset's group when stacking a
  // new version, otherwise this row is the head of its own new group (its
  // own id, generated up front so it can self-reference in one insert).
  const newAssetId = randomUUID()

  const { data: asset, error } = await supabaseAdmin
    .from('assets')
    .insert({
      id: newAssetId,
      project_id,
      uploaded_by: user.id,
      name,
      version: nextVersion,
      status: 'processing',
      pipeline_status: linkedHead ? 'review' : 'idea',
      cut_type: cutType,
      mux_upload_id: upload.id,
      asset_group_id: linkedHead ? linkedHead.asset_group_id : newAssetId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // A new version reopens the pipeline (e.g. re-cutting an already-approved
  // asset), so the project's aggregate status can no longer be "approved".
  if (linkedHead) await syncProjectStatus(project_id)

  return NextResponse.json({ asset, upload_url: upload.url, upload_id: upload.id }, { status: 201 })
}