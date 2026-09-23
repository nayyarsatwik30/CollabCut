import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { createNotification } from '@/lib/notifications'
import { requireAuth, canAccessAsset } from '@/lib/api-auth'
import { verifyShareAccess } from '@/lib/share-access'

// Two ways in, same as GET /api/comments: a logged-in admin/assigned editor
// on the comment's asset (the review screen), or a valid share token (plus
// its password, if set) for that asset's lineage (the public /r/[token]
// page). A logged-in reply is always attributed to the caller's own profile
// - author_name from the body is only used for share-link reviewers, who
// have no account to take a name from.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { text, author_name, share_token, share_password } = await req.json()
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const parentResult = await migrationDb.query(
    `SELECT c.author_id, c.asset_id, p.name AS project_name
     FROM comments c
     JOIN assets a ON a.id = c.asset_id
     JOIN projects p ON p.id = a.project_id
     WHERE c.id = $1`,
    [params.id]
  )
  const parent = parentResult.rows[0]
  if (!parent) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

  let userId: string | null = null
  let authorName: string

  if (share_token) {
    const authorized = await verifyShareAccess(parent.asset_id, share_token, share_password ?? null)
    if (!authorized) return NextResponse.json({ error: 'Not authorized to reply to this comment' }, { status: 403 })
    authorName = (typeof author_name === 'string' && author_name.trim()) || 'Anonymous'
  } else {
    const auth = await requireAuth(req)
    if ('error' in auth) return auth.error
    if (!(await canAccessAsset(auth.user.id, parent.asset_id))) {
      return NextResponse.json({ error: 'Not authorized to reply to this comment' }, { status: 403 })
    }
    userId = auth.user.id
    const profileResult = await migrationDb.query(`SELECT name, email FROM profiles WHERE id = $1`, [userId])
    const profile = profileResult.rows[0]
    authorName = profile?.name || profile?.email || auth.user.email || 'Unknown'
  }

  const result = await migrationDb.query(
    `INSERT INTO replies (comment_id, text, author_id, author_name) VALUES ($1, $2, $3, $4) RETURNING *`,
    [params.id, text, userId, authorName]
  )

  // Notify the original commenter - unless they're replying to their own
  // comment, or the comment has no account behind it (share-link comments).
  // Best-effort, same as the top-level comment trigger: the reply itself
  // already succeeded.
  if (parent.author_id && parent.author_id !== userId) {
    await createNotification({
      userId: parent.author_id,
      type: 'comment_reply',
      message: `${authorName} replied to your comment on ${parent.project_name ?? 'Untitled project'}`,
      link: `/review/${parent.asset_id}`,
      assetId: parent.asset_id,
    })
  }

  return NextResponse.json({ reply: result.rows[0] }, { status: 201 })
}
