import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { video } from '@/lib/mux'
import { syncProjectStatus } from '@/lib/project-status'
import { notifyWorkspaceAdmins } from '@/lib/notifications'

// Shared context every upload-triggered notification needs - the project's
// display name/workspace (to fan a notification out to its admins) and the
// uploader's display name (for the message text).
async function getUploadNotificationContext(projectId: string, uploaderId: string) {
  const [{ data: projectRow }, { data: uploaderProfile }] = await Promise.all([
    supabaseAdmin.from('projects').select('name, workspace_id').eq('id', projectId).maybeSingle(),
    supabaseAdmin.from('profiles').select('name, email').eq('id', uploaderId).maybeSingle(),
  ])
  return {
    projectName: projectRow?.name ?? 'Untitled project',
    workspaceId: (projectRow?.workspace_id as string | null) ?? null,
    uploaderName: uploaderProfile?.name ?? uploaderProfile?.email ?? 'An editor',
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { project_id, name, linked_asset_name, cut_type, fulfill_asset_id: requestedFulfillAssetId } = await req.json()

  let fulfill_asset_id = requestedFulfillAssetId

  // A plain Board Cut upload (the section's generic "Upload" button, not the
  // placeholder's own "Upload cut" button) auto-fulfills a pending New
  // Content placeholder in the same project if one exists, instead of
  // silently creating a disconnected asset next to it - same outcome as
  // using the placeholder's own upload button, regardless of which button
  // was actually clicked.
  if (!fulfill_asset_id && !linked_asset_name && project_id && (cut_type ?? 'board') === 'board') {
    const { data: pending } = await supabaseAdmin
      .from('assets')
      .select('id')
      .eq('project_id', project_id)
      .eq('cut_type', 'board')
      .is('mux_upload_id', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
    fulfill_asset_id = pending?.[0]?.id
  }

  // Fulfilling a New Content placeholder: attach the file to the EXISTING
  // asset row in place (same id/version/group), rather than creating a new
  // one - the placeholder just goes from "no file" to "has a file."
  if (fulfill_asset_id) {
    const { data: target, error: targetError } = await supabaseAdmin
      .from('assets')
      .select('id, project_id, mux_upload_id')
      .eq('id', fulfill_asset_id)
      .single()

    if (targetError || !target) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    if (target.mux_upload_id) return NextResponse.json({ error: 'This asset already has a file' }, { status: 400 })

    const upload = await video.uploads.create({
      cors_origin: process.env.NEXT_PUBLIC_APP_URL!,
      new_asset_settings: {
        playback_policy: ['public'],
        mp4_support: 'capped-1080p',
      },
    })

    const { data: asset, error } = await supabaseAdmin
      .from('assets')
      .update({
        status: 'processing',
        pipeline_status: 'review',
        mux_upload_id: upload.id,
      })
      .eq('id', fulfill_asset_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await syncProjectStatus(target.project_id)

    // Trigger 2: a fulfilled placeholder is always a Board Cut v1 - no prior
    // version, so trigger 4 never applies here.
    const { projectName, workspaceId, uploaderName } = await getUploadNotificationContext(target.project_id, user.id)
    if (workspaceId) {
      await notifyWorkspaceAdmins(workspaceId, {
        type: 'cut_uploaded',
        message: `${uploaderName} uploaded v${asset.version} for ${projectName} — ready for review`,
        link: `/review/${fulfill_asset_id}`,
        assetId: fulfill_asset_id,
      })
    }

    return NextResponse.json({ asset, upload_url: upload.url, upload_id: upload.id }, { status: 201 })
  }

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

    // A lineage's v1 (its earliest version) must have a real file before any
    // new version can stack on top of it - otherwise the placeholder never
    // gets fulfilled and is left orphaned underneath a "v2".
    if (linkedHead) {
      const { data: origin } = await supabaseAdmin
        .from('assets')
        .select('mux_upload_id')
        .eq('asset_group_id', linkedHead.asset_group_id)
        .order('version', { ascending: true })
        .limit(1)
        .single()

      if (origin && !origin.mux_upload_id) {
        return NextResponse.json({ error: 'Fulfill v1 before uploading a new version' }, { status: 400 })
      }
    }
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

  // Triggers 2 & 4: Custom Cut uploads never notify (no review pipeline).
  // Trigger 4 supersedes trigger 2 when this new version is stacked on a
  // previous version that already has a comment thread - two notifications
  // instead of the generic one, never both, per spec.
  if (cutType === 'board') {
    const { projectName, workspaceId, uploaderName } = await getUploadNotificationContext(project_id, user.id)
    if (workspaceId) {
      let hasPriorComment = false
      if (linkedHead) {
        const { count } = await supabaseAdmin
          .from('comments')
          .select('id', { count: 'exact', head: true })
          .eq('asset_id', linkedHead.id)
        hasPriorComment = (count ?? 0) > 0
      }

      if (linkedHead && hasPriorComment) {
        await notifyWorkspaceAdmins(workspaceId, {
          type: 'comment_reply',
          message: `${uploaderName} replied to your comment on ${projectName}`,
          link: `/review/${linkedHead.id}`,
          assetId: linkedHead.id,
        })
        await notifyWorkspaceAdmins(workspaceId, {
          type: 'version_ready',
          message: `Version ${nextVersion} uploaded for ${projectName} — ready to approve`,
          link: `/review/${newAssetId}`,
          assetId: newAssetId,
        })
      } else {
        await notifyWorkspaceAdmins(workspaceId, {
          type: 'cut_uploaded',
          message: `${uploaderName} uploaded v${nextVersion} for ${projectName} — ready for review`,
          link: `/review/${newAssetId}`,
          assetId: newAssetId,
        })
      }
    }
  }

  return NextResponse.json({ asset, upload_url: upload.url, upload_id: upload.id }, { status: 201 })
}