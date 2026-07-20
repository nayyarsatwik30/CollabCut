import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const { error } = await supabaseAdmin
        .from('assets')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}