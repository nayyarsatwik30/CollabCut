import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'
import { canAccessChannel, chatErrorResponse, isUuid, parseChannel } from '@/lib/chat'

// Marks the caller's conversation as read up to now.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  const workspaceId = body?.workspaceId
  const channel = parseChannel(body?.channel)
  if (!isUuid(workspaceId) || channel === null) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })

  try {
    if (!(await canAccessChannel(workspaceId, user.id, channel))) {
      return NextResponse.json({ error: 'No access to this channel' }, { status: 403 })
    }
    await migrationDb.query(
      `INSERT INTO chat_reads (workspace_id, user_id, channel, last_read_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (workspace_id, user_id, channel) DO UPDATE SET last_read_at = now()`,
      [workspaceId, user.id, channel],
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    return chatErrorResponse(err)
  }
}
