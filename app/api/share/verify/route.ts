import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifySharePassword } from '@/lib/share-password'

// Public, unauthenticated - lets the /r/[token] password gate check a
// visitor-entered password without ever handing the hash to the client.
export async function POST(req: NextRequest) {
  const { token, password } = await req.json()
  if (!token || !password) return NextResponse.json({ error: 'token and password required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('share_links')
    .select('password_hash, expires_at')
    .eq('token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }
  if (!data.password_hash) return NextResponse.json({ valid: true })

  return NextResponse.json({ valid: verifySharePassword(password, data.password_hash) })
}
