import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'
import { chatErrorResponse, isUuid, isWorkspaceMember } from '@/lib/chat'

// Marks the caller's conversation as read up to now.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  const workspaceId = body?.workspaceId
  if (!isUuid(workspaceId)) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })

  try {
    if (!(await isWorkspaceMember(workspaceId, user.id))) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 })
    }
    await migrationDb.query(
      `INSERT INTO chat_reads (workspace_id, user_id, last_read_at) VALUES ($1, $2, now())
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET last_read_at = now()`,
      [workspaceId, user.id],
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    return chatErrorResponse(err)
  }
}
