import { NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { hashPassword } from '@/lib/password'

export async function POST(req: Request) {
  const { name, email, password } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email, and password are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const client = await migrationDb.connect()

  try {
    const existing = await client.query('SELECT id FROM auth_credentials WHERE email = $1', [normalizedEmail])
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'an account with that email already exists' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)

    await client.query('BEGIN')
    const profileResult = await client.query(
      'INSERT INTO profiles (name, email) VALUES ($1, $2) RETURNING id',
      [name, normalizedEmail]
    )
    const profileId = profileResult.rows[0].id

    await client.query(
      'INSERT INTO auth_credentials (id, email, password_hash) VALUES ($1, $2, $3)',
      [profileId, normalizedEmail, passwordHash]
    )

    const workspaceResult = await client.query(
      "INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING id",
      [`${name}'s Workspace`, profileId]
    )
    const workspaceId = workspaceResult.rows[0].id

    await client.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')",
      [workspaceId, profileId]
    )

    await client.query('COMMIT')

    return NextResponse.json({ id: profileId, email: normalizedEmail, name, workspaceId })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('signup failed', err)
    return NextResponse.json({ error: 'signup failed' }, { status: 500 })
  } finally {
    client.release()
  }
}
