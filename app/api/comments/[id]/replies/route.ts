import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { text, author_name } = await req.json()

  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('replies')
    .insert({
      comment_id: params.id,
      text,
      author_id: user?.id ?? null,
      author_name: author_name ?? 'Anonymous',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reply: data }, { status: 201 })
}