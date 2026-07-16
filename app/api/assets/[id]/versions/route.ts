import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: current, error: currentError } = await supabaseAdmin
    .from('assets')
    .select('project_id, name')
    .eq('id', params.id)
    .single()

  if (currentError || !current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: versions, error } = await supabaseAdmin
    .from('assets')
    .select('id, version, name, status, created_at, size_bytes')
    .eq('project_id', current.project_id)
    .eq('name', current.name)
    .order('version', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ versions: versions ?? [] })
}