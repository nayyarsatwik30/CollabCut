import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { requireAuth } from '@/lib/api-auth'
import {
  CHAT_MAX_LENGTH, CHAT_PAGE_SIZE, CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_SECONDS,
  canAccessChannel, chatErrorResponse, isUuid, parseChannel,
} from '@/lib/chat'

// Latest messages of a workspace conversation, oldest first. Members only.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  const channel = parseChannel(req.nextUrl.searchParams.get('channel') ?? '')
  if (!isUuid(workspaceId) || channel === null) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })

  try {
    if (!(await canAccessChannel(workspaceId, user.id, channel))) {
      return NextResponse.json({ error: 'No access to this channel' }, { status: 403 })
    }
    const result = await migrationDb.query(
      `SELECT * FROM (
         SELECT m.id, m.body, m.created_at, m.sender_id, COALESCE(p.name, 'Former member') AS sender_name
         FROM chat_messages m
         LEFT JOIN profiles p ON p.id = m.sender_id
         WHERE m.workspace_id = $1 AND m.channel = $2
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT $3
       ) latest ORDER BY created_at ASC, id ASC`,
      [workspaceId, channel, CHAT_PAGE_SIZE],
    )
    return NextResponse.json({
      messages: result.rows.map((r) => ({
        id: r.id,
        body: r.body,
        created_at: r.created_at,
        sender_id: r.sender_id,
        sender_name: r.sender_name,
        mine: r.sender_id === user.id,
      })),
    })
  } catch (err) {
    return chatErrorResponse(err)
  }
}

// Posts a text message. The sender is always the authenticated user - never
// read from the request body.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const payload = await req.json().catch(() => null)
  const workspaceId = payload?.workspaceId
  const channel = parseChannel(payload?.channel)
  const text = typeof payload?.body === 'string' ? payload.body.trim() : ''
  if (!isUuid(workspaceId) || channel === null) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  if (!text) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  if (text.length > CHAT_MAX_LENGTH) {
    return NextResponse.json({ error: `Message is too long (max ${CHAT_MAX_LENGTH} characters)` }, { status: 400 })
  }

  try {
    if (!(await canAccessChannel(workspaceId, user.id, channel))) {
      return NextResponse.json({ error: 'No access to this channel' }, { status: 403 })
    }

    // Rate-limit check and insert run in one transaction under a per-user
    // advisory lock, so concurrent POSTs (even across serverless instances)
    // can't all read a count below the cap and then all insert.
    const client = await migrationDb.connect()
    let row
    try {
      await client.query('BEGIN')
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`chat-send:${user.id}`])
      const recent = await client.query(
        `SELECT COUNT(*) FROM chat_messages WHERE sender_id = $1 AND created_at > now() - make_interval(secs => $2)`,
        [user.id, CHAT_RATE_WINDOW_SECONDS],
      )
      if (Number(recent.rows[0].count) >= CHAT_RATE_LIMIT) {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { error: 'You are sending messages too quickly. Wait a moment and try again.' },
          { status: 429, headers: { 'Retry-After': String(CHAT_RATE_WINDOW_SECONDS) } },
        )
      }
      const inserted = await client.query(
        `INSERT INTO chat_messages (workspace_id, channel, sender_id, body) VALUES ($1, $2, $3, $4) RETURNING id, body, created_at, sender_id`,
        [workspaceId, channel, user.id, text],
      )
      row = inserted.rows[0]
      // Sending counts as having read everything up to now.
      await client.query(
        `INSERT INTO chat_reads (workspace_id, user_id, channel, last_read_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (workspace_id, user_id, channel) DO UPDATE SET last_read_at = now()`,
        [workspaceId, user.id, channel],
      )
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
    return NextResponse.json({ message: { ...row, sender_name: '', mine: true } }, { status: 201 })
  } catch (err) {
    return chatErrorResponse(err)
  }
}
