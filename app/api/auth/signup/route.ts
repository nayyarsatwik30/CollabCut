import { NextRequest, NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { hashPassword } from '@/lib/password'
import { DEFAULT_WORKSPACE_PLAN_ID } from '@/lib/storage-config'
import { createVerificationToken, sendVerificationEmail } from '@/lib/email-verification'

// Creates the profile + auth_credentials + workspace role in one CloudClusters
// transaction, so a failure partway through (bad invite code, duplicate
// email, etc.) never leaves behind a created-but-unassigned account. Keeps
// this route's admin/editor branching and response contract (SignupForm.tsx
// expects workspace.invite_code for admins).
//
// The account is created unverified and is NOT signed in: a verification link
// is emailed (after COMMIT) and authorize() rejects login until it's clicked.
// A failed email send doesn't undo the signup - the user can request another
// from the login page - it's reported as verificationEmailSent: false.
// plan_id / billing_cycle come from the pricing page choice; they used to be
// applied by a post-signin PATCH /api/me/plan, which can't run without a session.
export async function POST(req: NextRequest) {
  const { name, email, password, role, inviteCode, plan_id, billing_cycle } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  if (role !== 'admin' && role !== 'editor') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const client = await migrationDb.connect()

  try {
    const existing = await client.query('SELECT id FROM auth_credentials WHERE email = $1', [normalizedEmail])
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 })
    }

    // Resolve the target workspace *before* creating any account, so an
    // invalid invite code never results in a broken/unassigned signup.
    let targetWorkspace: { id: string; name: string } | null = null
    if (role === 'editor') {
      const code = (inviteCode ?? '').trim()
      if (!code) {
        return NextResponse.json({ error: 'Workspace code is required' }, { status: 400 })
      }

      const workspaceResult = await client.query('SELECT id, name FROM workspaces WHERE invite_code = $1', [code])
      if (workspaceResult.rows.length === 0) {
        return NextResponse.json({ error: 'Invalid workspace code' }, { status: 400 })
      }
      targetWorkspace = workspaceResult.rows[0]
    }

    let planId: string | null = null
    if (typeof plan_id === 'string' && plan_id) {
      const planResult = await client.query('SELECT id FROM plans WHERE id = $1', [plan_id])
      planId = planResult.rows[0]?.id ?? null
    }
    const billingCycle = billing_cycle === 'yearly' ? 'yearly' : 'monthly'

    const passwordHash = await hashPassword(password)
    const verification = createVerificationToken()

    await client.query('BEGIN')

    const profileResult = await client.query(
      `INSERT INTO profiles (name, email, plan_id, billing_cycle)
       VALUES ($1, $2, COALESCE($3, 'basic'), $4) RETURNING id`,
      [name, normalizedEmail, planId, billingCycle]
    )
    const userId = profileResult.rows[0].id

    await client.query(
      `INSERT INTO auth_credentials
         (id, email, password_hash, email_verification_token_hash, email_verification_expires)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, normalizedEmail, passwordHash, verification.hash, verification.expires]
    )

    if (role === 'admin') {
      const workspaceResult = await client.query(
        'INSERT INTO workspaces (name, owner_id, workspace_plan_id) VALUES ($1, $2, $3) RETURNING id, name, invite_code',
        [`${name}'s Workspace`, userId, DEFAULT_WORKSPACE_PLAN_ID]
      )
      const workspace = workspaceResult.rows[0]

      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')`,
        [workspace.id, userId]
      )

      await client.query('COMMIT')
      const verificationEmailSent = await sendVerification(normalizedEmail, name, verification.token)
      return NextResponse.json(
        {
          user: { id: userId, email: normalizedEmail },
          workspace: { id: workspace.id, name: workspace.name, invite_code: workspace.invite_code },
          verificationEmailSent,
        },
        { status: 201 }
      )
    }

    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'editor')`,
      [targetWorkspace!.id, userId]
    )

    await client.query('COMMIT')
    const verificationEmailSent = await sendVerification(normalizedEmail, name, verification.token)
    return NextResponse.json(
      {
        user: { id: userId, email: normalizedEmail },
        workspace: { id: targetWorkspace!.id, name: targetWorkspace!.name },
        verificationEmailSent,
      },
      { status: 201 }
    )
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('signup failed', err)
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  } finally {
    client.release()
  }
}

async function sendVerification(email: string, name: string, token: string): Promise<boolean> {
  try {
    await sendVerificationEmail(email, name, token)
    return true
  } catch (err) {
    console.error('verification email failed', err)
    return false
  }
}
