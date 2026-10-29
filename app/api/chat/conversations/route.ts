import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'
import { chatErrorResponse } from '@/lib/chat'

// Every workspace the caller belongs to (admin or editor), each with its
// unread count. A conversation == a workspace.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  try {
    const result = await migrationDb.query(
      `SELECT w.id, w.name, wm.role,
              (SELECT COUNT(*) FROM chat_messages m
                WHERE m.workspace_id = w.id AND m.sender_id <> $1
                  AND m.created_at > COALESCE(cr.last_read_at, wm.joined_at)) AS unread
       FROM workspace_members wm
       JOIN workspaces w ON w.id = wm.workspace_id
       LEFT JOIN chat_reads cr ON cr.workspace_id = w.id AND cr.user_id = $1
       WHERE wm.user_id = $1
       ORDER BY w.created_at ASC`,
      [user.id],
    )
    return NextResponse.json({
      conversations: result.rows.map((r) => ({ id: r.id, name: r.name, role: r.role, unread: Number(r.unread) })),
    })
  } catch (err) {
    return chatErrorResponse(err)
  }
}
