import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { video, getCorsOrigin } from '@/lib/mux'
import { syncProjectStatus } from '@/lib/project-status'
import { notifyWorkspaceAdmins } from '@/lib/notifications'
import { requireAuth, projectMembership, canAccessAsset, signCancelToken } from '@/lib/api-auth'

// Shared context every upload-triggered notification needs - the project's
// display name/workspace (to fan a notification out to its admins) and the
// uploader's display name (for the message text).
async function getUploadNotificationContext(projectId: string, uploaderId: string) {
  const [projectResult, uploaderResult] = await Promise.all([
    migrationDb.query(`SELECT name, workspace_id FROM projects WHERE id = $1`, [projectId]),
    migrationDb.query(`SELECT name, email FROM profiles WHERE id = $1`, [uploaderId]),
  ])
  const projectRow = projectResult.rows[0]
  const uploaderProfile = uploaderResult.rows[0]
  return {
    projectName: projectRow?.name ?? 'Untitled project',
    workspaceId: (projectRow?.workspace_id as string | null) ?? null,
    uploaderName: uploaderProfile?.name ?? uploaderProfile?.email ?? 'An editor',
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { project_id, name, linked_asset_name, cut_type, fulfill_asset_id: requestedFulfillAssetId, size_bytes } = await req.json()

  // The file goes browser -> Mux directly and Mux never reports the original
  // file's size back, so the client's File.size is the only source for
  // size_bytes - which /api/storage-usage sums. Without it every asset sits
  // at the column default of 0 and the storage bar never moves.
  const sizeBytes = Number.isSafeInteger(size_bytes) && size_bytes >= 0 ? size_bytes : 0

  // Every upload lands in some project - the placeholder's own project when
  // fulfilling, otherwise project_id - and the caller must belong to that
  // project's workspace. Checked before anything else touches the project:
  // uploading a version into a lineage grants access to the whole lineage
  // (isAssignedEditor), so an unchecked upload would let an outsider take
  // over someone else's video.
  let destinationProjectId: string | undefined = project_id
  if (requestedFulfillAssetId) {
    const placeholderResult = await migrationDb.query(
      `SELECT project_id FROM assets WHERE id = $1 AND deleted_at IS NULL`,
      [requestedFulfillAssetId]
    )
    if (!placeholderResult.rows[0]) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    destinationProjectId = placeholderResult.rows[0].project_id
  }
  if (destinationProjectId) {
    const membership = await projectMembership(destinationProjectId, user.id)
    if (membership === 'missing') return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (membership === 'not_member') {
      return NextResponse.json({ error: 'Not authorized to upload to this project' }, { status: 403 })
    }
  }

  let fulfill_asset_id = requestedFulfillAssetId

  // A plain Board Cut upload (the section's generic "Upload" button, not the
  // placeholder's own "Upload cut" button) auto-fulfills a pending New
  // Content placeholder in the same project if one exists, instead of
  // silently creating a disconnected asset next to it - same outcome as
  // using the placeholder's own upload button, regardless of which button
  // was actually clicked.
  if (!fulfill_asset_id && !linked_asset_name && project_id && (cut_type ?? 'board') === 'board') {
    const pendingResult = await migrationDb.query(
      `SELECT id FROM assets
       WHERE project_id = $1 AND cut_type = 'board' AND mux_upload_id IS NULL AND deleted_at IS NULL
       ORDER BY created_at ASC LIMIT 1`,
      [project_id]
    )
    fulfill_asset_id = pendingResult.rows[0]?.id
  }

  // Fulfilling a New Content placeholder: attach the file to the EXISTING
  // asset row in place (same id/version/group), rather than creating a new
  // one - the placeholder just goes from "no file" to "has a file."
  if (fulfill_asset_id) {
    const targetResult = await migrationDb.query(
      `SELECT id, project_id, mux_upload_id FROM assets WHERE id = $1`,
      [fulfill_asset_id]
    )
    const target = targetResult.rows[0]

    if (!target) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    if (target.mux_upload_id) return NextResponse.json({ error: 'This asset already has a file' }, { status: 400 })

    const upload = await video.uploads.create({
      cors_origin: getCorsOrigin(req),
      new_asset_settings: {
        playback_policy: ['public'],
        mp4_support: 'capped-1080p',
        video_quality: 'plus',
      },
    })

    const updateResult = await migrationDb.query(
      `UPDATE assets SET status = 'processing', pipeline_status = 'review', mux_upload_id = $1, size_bytes = $2 WHERE id = $3 RETURNING *`,
      [upload.id, sizeBytes, fulfill_asset_id]
    )
    const asset = updateResult.rows[0]

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
      }, user.id)
    }

    // The token lets the cancel flow restore this placeholder instead of
    // deleting it, without trusting the client to say which case it is.
    return NextResponse.json({
      asset, upload_url: upload.url, upload_id: upload.id,
      cancel_token: signCancelToken(asset.id, upload.id, true),
    }, { status: 201 })
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
    const existingResult = await migrationDb.query(
      `SELECT id, version, asset_group_id, cut_type FROM assets
       WHERE project_id = $1 AND name = $2 AND deleted_at IS NULL ORDER BY version DESC LIMIT 1`,
      [project_id, linked_asset_name]
    )
    linkedHead = existingResult.rows[0] ?? null

    // Stacking a version makes the uploader part of the lineage, which grants
    // access to all of it (isAssignedEditor) - so only someone who can
    // already access this video may add a version to it. Workspace
    // membership alone isn't enough: an unassigned editor could otherwise
    // take over any video in the workspace.
    if (linkedHead && !(await canAccessAsset(user.id, linkedHead.id))) {
      return NextResponse.json({ error: 'Not authorized to add a version to this video' }, { status: 403 })
    }

    // A lineage's v1 (its earliest version) must have a real file before any
    // new version can stack on top of it - otherwise the placeholder never
    // gets fulfilled and is left orphaned underneath a "v2".
    if (linkedHead) {
      const originResult = await migrationDb.query(
        `SELECT mux_upload_id FROM assets WHERE asset_group_id = $1 ORDER BY version ASC LIMIT 1`,
        [linkedHead.asset_group_id]
      )
      const origin = originResult.rows[0]

      if (origin && !origin.mux_upload_id) {
        return NextResponse.json({ error: 'Fulfill v1 before uploading a new version' }, { status: 400 })
      }
    }
  } else if ((cut_type ?? 'board') === 'board') {
    const existingResult = await migrationDb.query(
      `SELECT id, version, asset_group_id, cut_type FROM assets
       WHERE project_id = $1 AND name = $2 AND cut_type = 'board' AND deleted_at IS NULL
       ORDER BY version DESC LIMIT 1`,
      [project_id, name]
    )
    linkedHead = existingResult.rows[0] ?? null

    // Same rule as an explicit version upload, but a filename collision with
    // a video the uploader can't access (and may not even see) shouldn't
    // block a normal first-time upload - it just becomes its own new video
    // instead of stacking onto someone else's.
    if (linkedHead && !(await canAccessAsset(user.id, linkedHead.id))) linkedHead = null
  }

  // A version upload always inherits its lineage's real cut_type - never
  // whatever the client sent - so a Custom Cut asset can't be flipped to
  // 'board' (or vice versa) by an "Upload new version" request.
  const cutType = linkedHead ? linkedHead.cut_type : (cut_type ?? 'board')
  const nextVersion = linkedHead ? linkedHead.version + 1 : 1

  const upload = await video.uploads.create({
    cors_origin: getCorsOrigin(req),
    new_asset_settings: {
      playback_policy: ['public'],
      mp4_support: 'capped-1080p',
      video_quality: 'plus',
    },
  })

  // asset_group_id ties every version of the same logical video together,
  // independent of filename: reuse the linked asset's group when stacking a
  // new version, otherwise this row is the head of its own new group (its
  // own id, generated up front so it can self-reference in one insert).
  const newAssetId = randomUUID()

  const insertResult = await migrationDb.query(
    `INSERT INTO assets (id, project_id, uploaded_by, name, version, status, pipeline_status, cut_type, mux_upload_id, asset_group_id, size_bytes)
     VALUES ($1,$2,$3,$4,$5,'processing',$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      newAssetId,
      project_id,
      user.id,
      name,
      nextVersion,
      linkedHead ? 'review' : 'idea',
      cutType,
      upload.id,
      linkedHead ? linkedHead.asset_group_id : newAssetId,
      sizeBytes,
    ]
  )
  const asset = insertResult.rows[0]

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
        const commentCountResult = await migrationDb.query(
          `SELECT COUNT(*) FROM comments WHERE asset_id = $1`,
          [linkedHead.id]
        )
        hasPriorComment = Number(commentCountResult.rows[0].count) > 0
      }

      if (linkedHead && hasPriorComment) {
        await notifyWorkspaceAdmins(workspaceId, {
          type: 'comment_reply',
          message: `${uploaderName} replied to your comment on ${projectName}`,
          link: `/review/${linkedHead.id}`,
          assetId: linkedHead.id,
        }, user.id)
        await notifyWorkspaceAdmins(workspaceId, {
          type: 'version_ready',
          message: `Version ${nextVersion} uploaded for ${projectName} — ready to approve`,
          link: `/review/${newAssetId}`,
          assetId: newAssetId,
        }, user.id)
      } else {
        await notifyWorkspaceAdmins(workspaceId, {
          type: 'cut_uploaded',
          message: `${uploaderName} uploaded v${nextVersion} for ${projectName} — ready for review`,
          link: `/review/${newAssetId}`,
          assetId: newAssetId,
        }, user.id)
      }
    }
  }

  return NextResponse.json({
    asset, upload_url: upload.url, upload_id: upload.id,
    cancel_token: signCancelToken(asset.id, upload.id, false),
  }, { status: 201 })
}