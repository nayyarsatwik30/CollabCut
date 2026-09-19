import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { migrationDb } from '@/lib/migrationDb'
import { video } from '@/lib/mux'
import { getSessionUserId } from '@/lib/migrationAuth'

export async function POST(req: Request) {
  const userId = await getSessionUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { project_id, name } = await req.json()
  if (!project_id || !name) {
    return NextResponse.json({ error: 'project_id and name are required' }, { status: 400 })
  }

  const project = await migrationDb.query('SELECT id FROM projects WHERE id = $1', [project_id])
  if (project.rows.length === 0) {
    return NextResponse.json({ error: 'project not found' }, { status: 404 })
  }

  const upload = await video.uploads.create({
    cors_origin: process.env.NEXT_PUBLIC_APP_URL!,
    new_asset_settings: {
      playback_policy: ['public'],
      mp4_support: 'capped-1080p',
      video_quality: 'plus',
    },
  })

  const newAssetId = randomUUID()

  const result = await migrationDb.query(
    `INSERT INTO assets (id, project_id, uploaded_by, name, status, mux_upload_id, asset_group_id)
     VALUES ($1, $2, $3, $4, 'processing', $5, $1)
     RETURNING id, project_id, name, status, mux_upload_id, created_at`,
    [newAssetId, project_id, userId, name, upload.id]
  )

  return NextResponse.json(
    { asset: result.rows[0], upload_url: upload.url, upload_id: upload.id },
    { status: 201 }
  )
}
