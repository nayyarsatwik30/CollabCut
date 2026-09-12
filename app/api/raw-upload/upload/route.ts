import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'
import { b2, B2_BUCKET } from '@/lib/b2'
import { MAX_RAW_FILE_BYTES } from '@/lib/raw-files'

// Server-proxied upload: the browser sends the file to us, we relay it to
// B2 server-side, so no cross-origin request to B2 ever happens. Uploading
// a large file through the function (rather than a direct browser PUT) can
// take a while, so give it more than the default execution budget.
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const formData = await req.formData()
  const file = formData.get('file')
  const projectId = formData.get('projectId')

  if (!(file instanceof File) || typeof projectId !== 'string' || !projectId) {
    return NextResponse.json({ error: 'file and projectId required' }, { status: 400 })
  }

  if (file.size > MAX_RAW_FILE_BYTES) {
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

  const b2Key = `${projectId}/${randomUUID()}-${file.name}`
  const contentType = file.type || 'application/octet-stream'
  const buffer = Buffer.from(await file.arrayBuffer())

  await b2.send(new PutObjectCommand({
    Bucket: B2_BUCKET,
    Key: b2Key,
    Body: buffer,
    ContentType: contentType,
  }))

  const { data, error } = await supabaseAdmin
    .from('raw_files')
    .insert({
      project_id: projectId,
      uploaded_by: user.id,
      file_name: file.name,
      b2_key: b2Key,
      file_size_bytes: file.size,
      content_type: contentType,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rawFile: data }, { status: 201 })
}
