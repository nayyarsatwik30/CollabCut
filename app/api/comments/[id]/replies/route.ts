import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { migrationDb } from '@/lib/migrationDb'

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

  return NextResponse.json({ reply: result.rows[0] }, { status: 201 })
}