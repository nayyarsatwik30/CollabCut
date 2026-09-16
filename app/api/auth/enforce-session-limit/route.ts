import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth } from '@/lib/api-auth'

const MAX_SESSIONS = 2

// Called once, right after a fresh sign-in - never on token refresh or
// cross-tab session sync (see SessionSync, which deliberately doesn't call
// this). No-ops for agency workspace members; enforce_session_limit itself
// checks workspaces.workspace_plan_id.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  const { error } = await supabaseAdmin.rpc('enforce_session_limit', {
    p_user_id: auth.user.id,
    p_max_sessions: MAX_SESSIONS,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
