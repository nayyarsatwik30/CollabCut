import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('workspace_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!project?.workspace_id) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const isAdmin = await hasWorkspaceRole(project.workspace_id, user.id, 'admin')
  if (!isAdmin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { data: rawFiles, error } = await supabaseAdmin
    .from('raw_files')
    .select('id, file_name, file_size_bytes, content_type, created_at, uploaded_by')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // raw_files.uploaded_by references auth.users, not profiles, so there's no
  // direct FK for PostgREST to embed through - fetch profiles separately.
  const uploaderIds = Array.from(new Set((rawFiles ?? []).map((f) => f.uploaded_by)))
  const { data: profileRows } = uploaderIds.length
    ? await supabaseAdmin.from('profiles').select('id, name, email').in('id', uploaderIds)
    : { data: [] }

  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]))

  const result = (rawFiles ?? []).map((f) => ({
    ...f,
    profiles: profileById.get(f.uploaded_by) ?? null,
  }))

  return NextResponse.json({ rawFiles: result })
}
