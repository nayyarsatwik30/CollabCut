import { NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'

export const CHAT_MAX_LENGTH = 2000
// Per-sender cap, enforced in the DB (count of the sender's own recent rows)
// so it holds across serverless instances without extra infrastructure.
export const CHAT_RATE_LIMIT = 20
export const CHAT_RATE_WINDOW_SECONDS = 60
export const CHAT_PAGE_SIZE = 150

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

// True if `userId` is an admin or editor of `workspaceId`. Checked on every
// request, so removing someone from a workspace cuts off chat immediately.
export async function isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
  const result = await migrationDb.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
    [workspaceId, userId],
  )
  return result.rows.length > 0
}

// Postgres "undefined_table": the chat migration hasn't been applied yet.
export function isMissingTable(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '42P01'
}

// Maps a thrown DB error to a response, so a missing chat table surfaces as a
// clear 503 for the chat routes only and never crashes anything else.
export function chatErrorResponse(err: unknown): NextResponse {
  if (isMissingTable(err)) {
    return NextResponse.json(
      { error: 'Chat is not set up yet. An admin needs to apply scripts/migrations/in-app-chat.sql.', code: 'chat_not_migrated' },
      { status: 503 },
    )
  }
  console.error('[chat]', (err as Error).message)
  return NextResponse.json({ error: 'Chat is temporarily unavailable.' }, { status: 500 })
}
