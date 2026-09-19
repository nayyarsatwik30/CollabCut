import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth-migration/[...nextauth]/route'
import { migrationDb } from '@/lib/migrationDb'

export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return (session?.user as { id?: string } | undefined)?.id ?? null
}

export async function getUserWorkspaceId(userId: string): Promise<string | null> {
  const result = await migrationDb.query(
    'SELECT workspace_id FROM workspace_members WHERE user_id = $1 ORDER BY joined_at ASC LIMIT 1',
    [userId]
  )
  return result.rows[0]?.workspace_id ?? null
}
