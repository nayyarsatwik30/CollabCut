import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspace_id, email, role } = await req.json()
  if (!workspace_id || !email || !role) {
    return NextResponse.json({ error: 'workspace_id, email, and role are required' }, { status: 400 })
  }
  if (!['admin', 'editor'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const { data: membership, error: memberError } = await supabaseAdmin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })
  if (!membership || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Only workspace admins can send invites' }, { status: 403 })
  }

  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('invites')
    .insert({ workspace_id, email, role, expires_at })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${data.token}`
  return NextResponse.json({ invite: data, url }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('invites')
    .select('*, workspaces(name)')
    .eq('token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })

  const expired = new Date(data.expires_at) < new Date()
  const used = !!data.used_at

  return NextResponse.json({
    invite: {
      workspace_id: data.workspace_id,
      workspace_name: data.workspaces?.name ?? 'this workspace',
      email: data.email,
      role: data.role,
      expired,
      used,
      valid: !expired && !used,
    },
  })
}
