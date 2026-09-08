import { supabaseAdmin } from '@/lib/supabase-admin'

interface NotifyInput {
  userId: string
  type: string
  message: string
  link?: string | null
  assetId?: string | null
}

// Single insert path for every notification trigger. A notification failing
// to write should never fail the action that triggered it (an upload or a
// comment still succeeds even if this errors), so failures are logged, not
// thrown.
export async function createNotification({ userId, type, message, link, assetId }: NotifyInput) {
  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    type,
    message,
    link: link ?? null,
    asset_id: assetId ?? null,
  })
  if (error) console.error(`[notifications] failed to create "${type}" for user ${userId}:`, error.message)
}

// Fans a notification out to every admin in a workspace - used for the
// upload triggers, where "the project's admin(s)" can be more than one.
export async function notifyWorkspaceAdmins(workspaceId: string, input: Omit<NotifyInput, 'userId'>) {
  const { data: admins, error } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'admin')

  if (error) {
    console.error(`[notifications] failed to look up admins for workspace ${workspaceId}:`, error.message)
    return
  }

  await Promise.all((admins ?? []).map((a) => createNotification({ ...input, userId: a.user_id })))
}
