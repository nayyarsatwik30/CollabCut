import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { projectId, fileName, b2Key, fileSizeBytes, contentType } = await req.json()
  if (!projectId || !fileName || !b2Key) {
    return NextResponse.json({ error: 'projectId, fileName and b2Key required' }, { status: 400 })
  }

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('workspace_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!project?.workspace_id) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const isAdmin = await hasWorkspaceRole(project.workspace_id, user.id, 'admin')
  if (!isAdmin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('raw_files')
    .insert({
      project_id: projectId,
      uploaded_by: user.id,
      file_name: fileName,
      b2_key: b2Key,
      file_size_bytes: fileSizeBytes ?? null,
      content_type: contentType ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rawFile: data }, { status: 201 })
}
