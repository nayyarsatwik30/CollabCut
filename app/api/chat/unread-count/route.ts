import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'
import { isMissingTable, messageVisibleSql } from '@/lib/chat'

// Sidebar badge. Deliberately never errors on a missing table (returns 0) so
// the badge poll stays quiet on deployments that haven't run the migration.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error

  try {
    const result = await migrationDb.query(
      `SELECT COUNT(*) FROM chat_messages m
       JOIN workspace_members wm ON wm.workspace_id = m.workspace_id AND wm.user_id = $1
       LEFT JOIN chat_reads cr ON cr.workspace_id = m.workspace_id AND cr.user_id = $1 AND cr.channel = m.channel
       WHERE m.sender_id <> $1 AND m.created_at > COALESCE(cr.last_read_at, wm.joined_at)
         AND ${messageVisibleSql('wm', '$1')}`,
      [auth.user.id],
    )
    return NextResponse.json({ count: Number(result.rows[0].count) })
  } catch (err) {
    if (!isMissingTable(err)) console.error('[chat] unread-count:', (err as Error).message)
    return NextResponse.json({ count: 0 })
  }
}
