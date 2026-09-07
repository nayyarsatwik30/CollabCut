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

  const { project_id, name, linked_asset_name } = await req.json()
  if (!project_id || !name) {
    return NextResponse.json({ error: 'project_id and name required' }, { status: 400 })
  }

  // Check for existing assets to auto-increment version. When linked_asset_name is
  // present (uploading a new cut from the review page), match on that instead of the
  // uploaded file's own name, since a re-export rarely keeps the original filename.
  const { data: existing } = await supabaseAdmin
    .from('assets')
    .select('id, version, asset_group_id')
    .eq('project_id', project_id)
    .eq('name', linked_asset_name || name)
    .order('version', { ascending: false })
    .limit(1)

  const linkedHead = existing && existing.length > 0 ? existing[0] : null
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