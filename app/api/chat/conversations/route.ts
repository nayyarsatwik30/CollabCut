import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'
import { CLIENT_KEY_SQL, CLIENT_LABEL_SQL, EDITOR_CLIENT_ACCESS_SQL, chatErrorResponse, messageVisibleSql } from '@/lib/chat'

// Every workspace the caller belongs to, each with its channels (General plus
// one per client the caller can see) and unread counts.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  try {
    const [workspaces, clients, unread] = await Promise.all([
      migrationDb.query(
        `SELECT w.id, w.name, wm.role FROM workspace_members wm
         JOIN workspaces w ON w.id = wm.workspace_id
         WHERE wm.user_id = $1 ORDER BY w.created_at ASC`,
        [user.id],
      ),
      migrationDb.query(
        `SELECT wm.workspace_id, ${CLIENT_KEY_SQL('p.client')} AS channel,
                MIN(${CLIENT_LABEL_SQL('p.client')}) AS label
         FROM workspace_members wm
         JOIN projects p ON p.workspace_id = wm.workspace_id AND p.deleted_at IS NULL
         WHERE wm.user_id = $1 AND btrim(COALESCE(p.client, '')) <> ''
           AND (wm.role = 'admin' OR ${EDITOR_CLIENT_ACCESS_SQL('p', '$1')})
         GROUP BY wm.workspace_id, ${CLIENT_KEY_SQL('p.client')}
         ORDER BY label ASC`,
        [user.id],
      ),
      migrationDb.query(
        `SELECT m.workspace_id, m.channel, COUNT(*) AS unread
         FROM chat_messages m
         JOIN workspace_members wm ON wm.workspace_id = m.workspace_id AND wm.user_id = $1
         LEFT JOIN chat_reads cr ON cr.workspace_id = m.workspace_id AND cr.user_id = $1 AND cr.channel = m.channel
         WHERE m.sender_id <> $1 AND m.created_at > COALESCE(cr.last_read_at, wm.joined_at)
           AND ${messageVisibleSql('wm', '$1')}
         GROUP BY m.workspace_id, m.channel`,
        [user.id],
      ),
    ])

    const unreadBy = new Map<string, number>()
    for (const r of unread.rows) unreadBy.set(`${r.workspace_id}|${r.channel}`, Number(r.unread))

    return NextResponse.json({
      workspaces: workspaces.rows.map((w) => ({
        id: w.id,
        name: w.name,
        role: w.role,
        channels: [
          { key: '', label: 'General', unread: unreadBy.get(`${w.id}|`) ?? 0 },
          ...clients.rows
            .filter((c) => c.workspace_id === w.id)
            .map((c) => ({ key: c.channel, label: c.label, unread: unreadBy.get(`${w.id}|${c.channel}`) ?? 0 })),
        ],
      })),
    })
  } catch (err) {
    return chatErrorResponse(err)
  }
}
