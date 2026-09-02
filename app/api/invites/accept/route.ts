import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const authToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!authToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authToken)
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from('invites')
    .select('*')
    .eq('token', token)
    .single()

  if (inviteError || !invite) return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })
  if (invite.used_at) return NextResponse.json({ error: 'This invite has already been used' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
  }
  if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'This invite was issued to a different email address' }, { status: 403 })
  }

  const { error: memberError } = await supabaseAdmin
    .from('workspace_members')
    .upsert(
      { workspace_id: invite.workspace_id, user_id: user.id, role: invite.role },
      { onConflict: 'workspace_id,user_id' }
    )

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  const { error: usedError } = await supabaseAdmin
    .from('invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invite.id)

  if (usedError) return NextResponse.json({ error: usedError.message }, { status: 500 })

  return NextResponse.json({ success: true, workspace_id: invite.workspace_id, role: invite.role })
}
