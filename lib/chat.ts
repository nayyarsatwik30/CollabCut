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

export const CHANNEL_MAX_LENGTH = 200

// SQL predicate: "message `m` is visible to the user in `wm`". `wm` must be a
// workspace_members row of that user for m.workspace_id; `userParam` is the
// placeholder holding the user id. The General channel ('') is open to every
// member. A client channel is open to workspace admins, and to editors only
// when they uploaded or are assigned an asset in a live project of that
// client - the same visibility the board gives editors. Trashed projects and
// assets never grant access. Client identity must match the SQL expression
// in CLIENT_KEY_SQL, which mirrors lib/clients.ts#clientKey on the
// feat/client-board-tabs branch: "c:" + trim, collapse whitespace, lowercase.
// (Chat has no no-client channel, so the __none__ case never occurs here.)
export const CLIENT_LABEL_SQL = (col: string) => `btrim(regexp_replace(${col}, '\\s+', ' ', 'g'))`
export const CLIENT_KEY_SQL = (col: string) => `('c:' || lower(${CLIENT_LABEL_SQL(col)}))`
export const EDITOR_CLIENT_ACCESS_SQL = (projectAlias: string, userParam: string) => `EXISTS (
  SELECT 1 FROM assets a WHERE a.project_id = ${projectAlias}.id AND a.deleted_at IS NULL
    AND (a.uploaded_by = ${userParam} OR EXISTS (SELECT 1 FROM asset_editors ae WHERE ae.asset_id = a.id AND ae.editor_id = ${userParam})))`
export const messageVisibleSql = (wmAlias: string, userParam: string) => `(m.channel = '' OR EXISTS (
  SELECT 1 FROM projects p WHERE p.workspace_id = m.workspace_id AND p.deleted_at IS NULL
    AND ${CLIENT_KEY_SQL('p.client')} = m.channel
    AND (${wmAlias}.role = 'admin' OR ${EDITOR_CLIENT_ACCESS_SQL('p', userParam)})))`

// True if `userId` may read/post `channel` in `workspaceId`. Checked on every request.
export async function canAccessChannel(workspaceId: string, userId: string, channel: string): Promise<boolean> {
  const member = await migrationDb.query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
    [workspaceId, userId],
  )
  const role = member.rows[0]?.role
  if (!role) return false
  if (channel === '') return true
  const result = await migrationDb.query(
    `SELECT 1 FROM projects p
     WHERE p.workspace_id = $1 AND p.deleted_at IS NULL AND ${CLIENT_KEY_SQL('p.client')} = $2
       AND ($3::text = 'admin' OR ${EDITOR_CLIENT_ACCESS_SQL('p', '$4')})
     LIMIT 1`,
    [workspaceId, channel, role, userId],
  )
  return result.rows.length > 0
}

// Postgres text can't hold NUL (22021 -> 500), so reject it up front with a 400.
export const hasNul = (v: string) => v.includes('\u0000')

// Parses the `channel` input: '' (General) when absent, else a bounded "c:<label>" client key.
export function parseChannel(v: unknown): string | null {
  if (v === undefined || v === null) return ''
  if (typeof v !== 'string' || v.length > CHANNEL_MAX_LENGTH * 2 || Array.from(v).length > CHANNEL_MAX_LENGTH || hasNul(v)) return null
  // '' = General; anything else must be a client key ("c:" + non-empty label).
  if (v !== '' && !(v.startsWith('c:') && v.length > 2)) return null
  return v
}

// SQL for a sender's display name: profile name, else the email local-part
// (never the domain), else a fixed fallback. Never empty.
export const SENDER_NAME_SQL = (profileAlias: string) => `COALESCE(
  NULLIF(btrim(${profileAlias}.name), ''),
  NULLIF(split_part(${profileAlias}.email, '@', 1), ''),
  'Unknown member')`

// Postgres "undefined_table": the chat migration hasn't been applied yet.
export function isMissingTable(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '42P01'
}

// Maps a thrown DB error to a response, so a missing chat table surfaces as a
// clear 503 for the chat routes only and never crashes anything else.
export function chatErrorResponse(err: unknown): NextResponse {
  if (isMissingTable(err)) {
    // Developer hint stays in the server log; end users get a plain message.
    console.error('[chat] chat tables are missing - apply scripts/migrations/in-app-chat.sql')
    return NextResponse.json(
      { error: "Chat isn't available right now. Try again in a minute.", code: 'chat_not_migrated' },
      { status: 503 },
    )
  }
  console.error('[chat]', (err as Error).message)
  return NextResponse.json({ error: 'Chat is temporarily unavailable.' }, { status: 500 })
}
