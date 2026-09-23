import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './authOptions'
import { migrationDb } from './migrationDb'

export type AuthUser = { id: string; email: string }
export type AuthResult = { user: AuthUser } | { error: NextResponse }

// Verifies the caller's NextAuth session (JWT, cookie-based) and returns the
// authenticated user - or a ready-to-return 401. `req` is accepted for call-site
// compatibility but unused: getServerSession reads the session from
// next/headers under the hood.
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const session = await getServerSession(authOptions)
  const sessionUser = session?.user as { id?: string; email?: string | null } | undefined
  if (!sessionUser?.id) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  return { user: { id: sessionUser.id, email: sessionUser.email ?? '' } }
}

// True if `userId` holds `role` in `workspaceId` - the workspace_members
// lookup already duplicated across the asset/project routes.
export async function hasWorkspaceRole(
  workspaceId: string,
  userId: string,
  role: 'admin' | 'editor',
): Promise<boolean> {
  const result = await migrationDb.query(
    `SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND role = $3 LIMIT 1`,
    [workspaceId, userId, role]
  )
  return result.rows.length > 0
}

// True if `userId` is assigned as an editor anywhere in `assetId`'s lineage.
// asset_editors pins an assignment to whichever specific version existed at
// assignment time, not the whole lineage, so a literal asset_id match here
// would go false the moment a new version is uploaded without a fresh
// assignment. Resolve at the asset_group_id level instead - the same
// resolution the editor branch of /api/board already does before deciding
// which cards to show that editor, and the same embedded-filter shape the
// POST handler in /api/board/editor/[editorId]/assets uses to check for an
// existing lineage assignment.
//
// Uploading any version in the lineage counts the same as an assignment. The
// upload route never creates an asset_editors row, so without this an
// editor's own brand-new upload 403'd for them (view, versions, comments)
// until an admin assigned it to them.
export async function isAssignedEditor(assetId: string, userId: string): Promise<boolean> {
  const assetResult = await migrationDb.query(
    `SELECT asset_group_id FROM assets WHERE id = $1`,
    [assetId]
  )
  const asset = assetResult.rows[0]
  if (!asset) return false
  const targetGroupId = asset.asset_group_id ?? assetId

  const accessResult = await migrationDb.query(
    `SELECT 1
     FROM assets a
     WHERE (a.asset_group_id = $2 OR a.id = $3)
       AND (a.uploaded_by = $1
            OR EXISTS (SELECT 1 FROM asset_editors ae WHERE ae.asset_id = a.id AND ae.editor_id = $1))
     LIMIT 1`,
    [userId, targetGroupId, assetId]
  )
  return accessResult.rows.length > 0
}

// True if `userId` is an admin of the asset's workspace, or is assigned as
// an editor on it - the same admin-or-assigned-editor gate every other
// asset-scoped route in the app uses.
export async function canAccessAsset(userId: string, assetId: string): Promise<boolean> {
  const assetResult = await migrationDb.query(
    `SELECT p.workspace_id FROM assets a
     JOIN projects p ON p.id = a.project_id
     WHERE a.id = $1`,
    [assetId]
  )
  const workspaceId = assetResult.rows[0]?.workspace_id ?? null

  const isAdmin = workspaceId ? await hasWorkspaceRole(workspaceId, userId, 'admin') : false
  return isAdmin || await isAssignedEditor(assetId, userId)
}

// Whether `userId` belongs (as admin or editor) to the workspace that owns
// `projectId` - 'missing' when the project doesn't exist or is in the trash,
// so callers can 404 instead of 403 (nothing should land in a trashed
// project).
export async function projectMembership(projectId: string, userId: string): Promise<'member' | 'not_member' | 'missing'> {
  const result = await migrationDb.query(
    `SELECT p.id, wm.user_id
     FROM projects p
     LEFT JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = $2
     WHERE p.id = $1 AND p.deleted_at IS NULL
     LIMIT 1`,
    [projectId, userId]
  )
  const row = result.rows[0]
  if (!row) return 'missing'
  return row.user_id ? 'member' : 'not_member'
}

// Authenticates the request, then requires `role` in `workspaceId` outright,
// with no "or assigned editor" escape hatch. Use for flat role gates where
// the workspace is already known - for resource-scoped routes (asset/
// project/comment) you'll usually fetch the resource first to find its
// workspace_id, then call hasWorkspaceRole directly to avoid a second
// token verification round trip.
export async function requireRole(
  req: NextRequest,
  workspaceId: string,
  role: 'admin' | 'editor',
): Promise<AuthResult> {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth

  const ok = await hasWorkspaceRole(workspaceId, auth.user.id, role)
  if (!ok) {
    return {
      error: NextResponse.json(
        { error: `${role === 'admin' ? 'Admin' : 'Editor'} access required` },
        { status: 403 },
      ),
    }
  }
  return auth
}
