import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'
import { b2, B2_BUCKET } from '@/lib/b2'
import { MAX_RAW_FILE_BYTES } from '@/lib/raw-files'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { projectId, fileName, contentType, fileSizeBytes } = await req.json()
  if (!projectId || !fileName || !fileSizeBytes) {
    return NextResponse.json({ error: 'projectId, fileName and fileSizeBytes required' }, { status: 400 })
  }

  if (fileSizeBytes > MAX_RAW_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds the 750MB archival limit' }, { status: 400 })
  }

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('workspace_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!project?.workspace_id) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const isAdmin = await hasWorkspaceRole(project.workspace_id, user.id, 'admin')
  if (!isAdmin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const b2Key = `${projectId}/${randomUUID()}-${fileName}`

  const command = new PutObjectCommand({
    Bucket: B2_BUCKET,
    Key: b2Key,
    ContentType: contentType || 'application/octet-stream',
  })

  const uploadUrl = await getSignedUrl(b2, command, { expiresIn: 15 * 60 })

  return NextResponse.json({ uploadUrl, b2Key })
}
