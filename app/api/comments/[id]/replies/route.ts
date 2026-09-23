import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { migrationDb } from '@/lib/migrationDb'
import { createNotification } from '@/lib/notifications'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const sessionUser = session?.user as { id?: string } | undefined
  const userId = sessionUser?.id ?? null

  const { text, author_name } = await req.json()
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const result = await migrationDb.query(
    `INSERT INTO replies (comment_id, text, author_id, author_name) VALUES ($1, $2, $3, $4) RETURNING *`,
    [params.id, text, userId, author_name ?? 'Anonymous']
  )

  // Notify the original commenter - unless they're replying to their own
  // comment, or the comment has no account behind it (share-link comments).
  // Best-effort, same as the top-level comment trigger: the reply itself
  // already succeeded.
  const parentResult = await migrationDb.query(
    `SELECT c.author_id, c.asset_id, p.name AS project_name
     FROM comments c
     JOIN assets a ON a.id = c.asset_id
     JOIN projects p ON p.id = a.project_id
     WHERE c.id = $1`,
    [params.id]
  )
  const parent = parentResult.rows[0] ?? null

  if (parent?.author_id && parent.author_id !== userId) {
    await createNotification({
      userId: parent.author_id,
      type: 'comment_reply',
      message: `${author_name ?? 'Someone'} replied to your comment on ${parent.project_name ?? 'Untitled project'}`,
      link: `/review/${parent.asset_id}`,
      assetId: parent.asset_id,
    })
  }

  return NextResponse.json({ reply: result.rows[0] }, { status: 201 })
}
