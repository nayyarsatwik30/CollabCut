import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const asset_id = new URL(req.url).searchParams.get('asset_id')
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('comments')
    .select('*, replies(*)')
    .eq('asset_id', asset_id)
    .order('time_sec', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const { data: { user } } = token
    ? await supabaseAdmin.auth.getUser(token)
    : { data: { user: null } }

  const { asset_id, time_sec, text, status, author_name } = await req.json()

  if (!asset_id || time_sec === undefined || !text) {
    return NextResponse.json({ error: 'asset_id, time_sec and text required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      asset_id,
      time_sec,
      text,
      status: status ?? 'open',
      author_id: user?.id ?? null,
      author_name: author_name ?? 'Anonymous',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment: data }, { status: 201 })
}