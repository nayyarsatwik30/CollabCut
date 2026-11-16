-- Reference-file attachments on review-screen comments. Idempotent - safe to
-- run more than once. Take a fresh backup (node scripts/db-backup/backup.js)
-- before running.
--
-- The file itself lives in raw_files (so it counts toward the same storage
-- quota as every other raw upload and is deleted the same way); this table
-- only links a raw_files row to a comment. comment_id stays NULL while the
-- file is "pending" (uploaded but its comment not posted yet).

CREATE TABLE IF NOT EXISTS comment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_file_id uuid NOT NULL UNIQUE REFERENCES raw_files(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comment_attachments_comment_id ON comment_attachments (comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_attachments_pending
  ON comment_attachments (asset_id, uploaded_by) WHERE comment_id IS NULL;
