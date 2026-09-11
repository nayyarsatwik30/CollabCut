import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createNotification } from '@/lib/notifications'
import { requireAuth, hasWorkspaceRole, isAssignedEditor } from '@/lib/api-auth'
import { verifyShareAccess } from '@/lib/share-access'

// True if `userId` is an admin of the asset's workspace, or is assigned as
// an editor on it - the same admin-or-assigned-editor gate every other
// asset-scoped route in the app uses.
async function canAccessAsset(userId: string, assetId: string): Promise<boolean> {
  const { data: assetMeta } = await supabaseAdmin
    .from('assets')
    .select('projects(workspace_id)')
    .eq('id', assetId)
    .maybeSingle()

  const workspaceId = assetMeta?.projects
    ? (Array.isArray(assetMeta.projects) ? assetMeta.projects[0]?.workspace_id : (assetMeta.projects as any).workspace_id)
    : null

  const isAdmin = workspaceId ? await hasWorkspaceRole(workspaceId, userId, 'admin') : false
  return isAdmin || await isAssignedEditor(assetId, userId)
}

// Comments are readable by a logged-in admin/assigned editor (the review
// screen) OR by anyone holding a valid, non-expired, correctly-passworded
// share link for this exact asset (the public /r/[token] page) - never by
// neither. Knowing an asset's UUID alone is not enough.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const asset_id = url.searchParams.get('asset_id')
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const shareToken = url.searchParams.get('share_token')
  let authorized = false

  if (shareToken) {
    authorized = await verifyShareAccess(asset_id, shareToken, url.searchParams.get('share_password'))
  } else {
    const auth = await requireAuth(req)
    if (!('error' in auth)) authorized = await canAccessAsset(auth.user.id, asset_id)
  }

  if (!authorized) return NextResponse.json({ error: 'Not authorized to view these comments' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('comments')
    .select('*, replies(*)')
    .eq('asset_id', asset_id)
    .order('time_sec', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data })
}

// No share-token path here - the public page posts comments through the
// dedicated, already-token-verified /api/share/comments instead. This one
// is for the review screen only: admin or assigned editor, full stop.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { asset_id, time_sec, text, status, author_name } = await req.json()

  if (!asset_id || time_sec === undefined || !text) {
    return NextResponse.json({ error: 'asset_id, time_sec and text required' }, { status: 400 })
  }

  const authorized = await canAccessAsset(user.id, asset_id)
  if (!authorized) return NextResponse.json({ error: 'Not authorized to comment on this asset' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      asset_id,
      time_sec,
      text,
      status: status ?? 'open',
      author_id: user.id,
      author_name: author_name ?? 'Anonymous',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trigger 3: only when the commenter is an admin (not the assigned editor
  // commenting on their own upload), and only if someone is actually
  // assigned to notify. Best-effort - the comment itself already succeeded.
  if (user?.id) {
    const { data: assetRow } = await supabaseAdmin
      .from('assets')
      .select('projects(name, workspace_id)')
      .eq('id', asset_id)
      .maybeSingle()
    const project = assetRow?.projects
      ? (Array.isArray(assetRow.projects) ? assetRow.projects[0] : assetRow.projects)
      : null

    if (project?.workspace_id) {
      const { data: membership } = await supabaseAdmin
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', project.workspace_id)
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle()

      if (membership) {
        const { data: assignment } = await supabaseAdmin
          .from('asset_editors')
          .select('editor_id')
          .eq('asset_id', asset_id)
          .maybeSingle()

        if (assignment?.editor_id) {
          await createNotification({
            userId: assignment.editor_id,
            type: 'comment_added',
            message: `New comment on ${project.name ?? 'Untitled project'}`,
            link: `/review/${asset_id}`,
            assetId: asset_id,
          })
        }
      }
    }
  }

  return NextResponse.json({ comment: data }, { status: 201 })
}