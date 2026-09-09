import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Creates the auth user together with their workspace role in one request,
// so a failure partway through (bad invite code, workspace insert error,
// etc.) never leaves behind a created-but-unassigned account.
export async function POST(req: NextRequest) {
  const { name, email, password, role, inviteCode } = await req.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  if (role !== 'admin' && role !== 'editor') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Resolve the target workspace *before* creating any account, so an
  // invalid invite code never results in a broken/unassigned signup.
  let targetWorkspace: { id: string; name: string } | null = null
  if (role === 'editor') {
    const code = (inviteCode ?? '').trim().toUpperCase()
    if (!code) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 })
    }

    const { data: workspace, error: lookupError } = await supabaseAdmin
      .from('workspaces')
      .select('id, name')
      .eq('invite_code', code)
      .maybeSingle()

    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
    if (!workspace) return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })
    targetWorkspace = workspace
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })

  if (createError) return NextResponse.json({ error: createError.message }, { status: 400 })
  const user = created.user

  if (role === 'admin') {
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .insert({ name: `${name}'s Workspace`, owner_id: user.id })
      .select()
      .single()

    if (workspaceError) {
      await supabaseAdmin.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: workspaceError.message }, { status: 500 })
    }

    const { error: memberError } = await supabaseAdmin
      .from('workspace_members')
      .insert({ workspace_id: workspace.id, user_id: user.id, role: 'admin' })

    if (memberError) {
      await supabaseAdmin.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        user: { id: user.id, email: user.email },
        workspace: { id: workspace.id, name: workspace.name, invite_code: workspace.invite_code },
      },
      { status: 201 }
    )
  }

  const { error: memberError } = await supabaseAdmin
    .from('workspace_members')
    .insert({ workspace_id: targetWorkspace!.id, user_id: user.id, role: 'editor' })

  if (memberError) {
    await supabaseAdmin.auth.admin.deleteUser(user.id)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json(
    { user: { id: user.id, email: user.email }, workspace: { id: targetWorkspace!.id, name: targetWorkspace!.name } },
    { status: 201 }
  )
}
