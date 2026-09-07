import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: current, error: currentError } = await supabaseAdmin
    .from('assets')
    .select('project_id, name, asset_group_id')
    .eq('id', params.id)
    .single()

  if (currentError || !current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: versions, error } = await supabaseAdmin
    .from('assets')
    .select('id, version, name, status, created_at, size_bytes, mux_playback_id, mux_upload_id')
    .eq('project_id', current.project_id)
    .eq('asset_group_id', current.asset_group_id)
    .order('version', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ versions: versions ?? [] })
}