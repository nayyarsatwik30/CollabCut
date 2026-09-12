import { NextRequest, NextResponse } from 'next/server'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, hasWorkspaceRole } from '@/lib/api-auth'
import { b2, B2_BUCKET } from '@/lib/b2'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if ('error' in auth) return auth.error
  const { user } = auth

  const { data: rawFile } = await supabaseAdmin
    .from('raw_files')
    .select('id, b2_key, project_id, projects(workspace_id)')
    .eq('id', params.id)
    .maybeSingle()

  if (!rawFile) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const project = Array.isArray(rawFile.projects) ? rawFile.projects[0] : rawFile.projects
  const workspaceId = project?.workspace_id as string | null
  if (!workspaceId) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const isAdmin = await hasWorkspaceRole(workspaceId, user.id, 'admin')
  if (!isAdmin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  try {
    await b2.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: rawFile.b2_key }))
  } catch (err) {
    // B2 cleanup failure shouldn't block removing the row - log and continue.
    console.error('B2 delete failed for', rawFile.b2_key, err)
  }

  const { error } = await supabaseAdmin.from('raw_files').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
