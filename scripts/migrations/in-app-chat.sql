-- In-app chat: one conversation per workspace (admins + editors of the
-- workspace). Idempotent - safe to run more than once. Take a fresh backup
-- (node scripts/db-backup/backup.js) before running.

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Message list (newest first per workspace) and the per-sender rate limit.
CREATE INDEX IF NOT EXISTS idx_chat_messages_workspace_created ON chat_messages (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_created ON chat_messages (sender_id, created_at DESC);

-- Per-user read marker for the unread badge.
CREATE TABLE IF NOT EXISTS chat_reads (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
