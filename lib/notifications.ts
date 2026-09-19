import { migrationDb } from '@/lib/migrationDb'

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
  try {
    await migrationDb.query(
      `INSERT INTO notifications (user_id, type, message, link, asset_id) VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, message, link ?? null, assetId ?? null]
    )
  } catch (err) {
    console.error(`[notifications] failed to create "${type}" for user ${userId}:`, (err as Error).message)
  }
}

// Fans a notification out to every admin in a workspace - used for the
// upload triggers, where "the project's admin(s)" can be more than one.
export async function notifyWorkspaceAdmins(
  workspaceId: string,
  input: Omit<NotifyInput, 'userId'>,
  excludeUserId?: string,
) {
  let admins: { user_id: string }[]
  try {
    const result = await migrationDb.query(
      `SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND role = 'admin'`,
      [workspaceId]
    )
    admins = result.rows
  } catch (err) {
    console.error(`[notifications] failed to look up admins for workspace ${workspaceId}:`, (err as Error).message)
    return
  }

  await Promise.all(
    admins
      .filter((a) => a.user_id !== excludeUserId)
      .map((a) => createNotification({ ...input, userId: a.user_id })),
  )
}
