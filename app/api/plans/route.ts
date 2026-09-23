import { NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'

// No request/session input here, so without this Next statically prerenders
// the route at build time and serves that frozen plans list forever.
export const dynamic = 'force-dynamic'

export async function GET() {
    const result = await migrationDb.query(`SELECT * FROM plans ORDER BY sort_order ASC`)
    return NextResponse.json({ plans: result.rows })
}
