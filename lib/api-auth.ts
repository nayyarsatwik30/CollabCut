import { NextRequest, NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabase-admin'

export type AuthResult = { user: User } | { error: NextResponse }

// Extracts the Bearer token, verifies it against Supabase, and returns the
// authenticated user - or a ready-to-return 401. Mirrors the token-check
// used correctly in assets/[id]/status and assets/[id]/complete.
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  return { user }
}

// True if `userId` holds `role` in `workspaceId` - the workspace_members
// lookup already duplicated across the asset/project routes.
export async function hasWorkspaceRole(
  workspaceId: string,
  userId: string,
  role: 'admin' | 'editor',
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('role', role)
    .maybeSingle()
  return !!data
}

// True if `userId` is assigned as an editor on `assetId` - the
// asset_editors lookup already duplicated in the asset status/detail routes.
export async function isAssignedEditor(assetId: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('asset_editors')
    .select('id')
    .eq('asset_id', assetId)
    .eq('editor_id', userId)
    .maybeSingle()
  return !!data
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
