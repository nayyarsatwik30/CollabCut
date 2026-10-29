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
// when they are assigned to a board cut in a live project of that client (see
// EDITOR_CLIENT_ACCESS_SQL) - the same visibility the board gives editors. Trashed projects and
// assets never grant access. Client identity must match the SQL expression
// in CLIENT_KEY_SQL, which mirrors lib/clients.ts#clientKey on the
// feat/client-board-tabs branch: "c:" + trim, collapse whitespace, lowercase.
// (Chat has no no-client channel, so the __none__ case never occurs here.)
export const CLIENT_LABEL_SQL = (col: string) => `btrim(regexp_replace(${col}, '\\s+', ' ', 'g'))`
export const CLIENT_KEY_SQL = (col: string) => `('c:' || lower(${CLIENT_LABEL_SQL(col)}))`
// Mirrors the editor branch of app/api/board/route.ts exactly: an editor is
// entitled to a project when they are assigned (asset_editors) to ANY version of
// a board-cut lineage (cut_type = 'board', assignment row's project not trashed,
// same workspace) and that project still holds a live (not deleted) asset of
// that lineage. The assignment row itself may sit on a trashed sibling. Merely
// uploading an asset does NOT grant access (the board doesn't show it either).
export const EDITOR_CLIENT_ACCESS_SQL = (projectAlias: string, userParam: string) => `EXISTS (
  SELECT 1 FROM assets x
  WHERE x.project_id = ${projectAlias}.id AND x.deleted_at IS NULL
    AND x.asset_group_id IN (
      SELECT y.asset_group_id FROM asset_editors ae
      JOIN assets y ON y.id = ae.asset_id
      JOIN projects yp ON yp.id = y.project_id
      WHERE ae.editor_id = ${userParam} AND y.cut_type = 'board'
        AND yp.deleted_at IS NULL AND yp.workspace_id = ${projectAlias}.workspace_id))`
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

// Postgres "undefined_table" for the CHAT tables specifically (migration not
// applied). A missing dependency table (e.g. asset_editors) must not count.
export function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null
  return e?.code === '42P01' && /chat_(messages|reads)/.test(e.message ?? '')
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
