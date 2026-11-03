import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'
import { canAccessChannel, chatErrorResponse, isUuid, parseChannel } from '@/lib/chat'

// Marks the caller's channel as read up to a given (fetched) message.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await req.json().catch(() => null)
  const workspaceId = body?.workspaceId
  const channel = parseChannel(body?.channel)
  const lastReadId = body?.lastReadId
  if (!isUuid(workspaceId) || channel === null || !isUuid(lastReadId)) {
    return NextResponse.json({ error: 'workspaceId and lastReadId are required' }, { status: 400 })
  }

  try {
    if (!(await canAccessChannel(workspaceId, user.id, channel))) {
      return NextResponse.json({ error: 'No access to this channel' }, { status: 403 })
    }
    // Advance the marker to a message the client actually fetched, never to
    // now(), so a message that arrived after the last fetch stays unread.
    const result = await migrationDb.query(
      `INSERT INTO chat_reads (workspace_id, user_id, channel, last_read_at)
       SELECT $1::uuid, $2::uuid, $3::text, m.created_at FROM chat_messages m
       WHERE m.id = $4 AND m.workspace_id = $1 AND m.channel = $3
       ON CONFLICT (workspace_id, user_id, channel) DO UPDATE
       SET last_read_at = GREATEST(chat_reads.last_read_at, EXCLUDED.last_read_at)`,
      [workspaceId, user.id, channel, lastReadId],
    )
    if (result.rowCount === 0) return NextResponse.json({ error: 'Message not found' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return chatErrorResponse(err)
  }
}
