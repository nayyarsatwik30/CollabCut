-- Cut priority: 1 (highest) to 3 (lowest), default 3. Idempotent - safe to
-- run more than once. Take a fresh backup (node scripts/db-backup/backup.js)
-- before running.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 3;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_priority_check') THEN
    ALTER TABLE assets ADD CONSTRAINT assets_priority_check CHECK (priority BETWEEN 1 AND 3);
  END IF;
END $$;

-- Every asset_group_id lookup already in the codebase (editor list,
-- drill-down, project view, review screen, share links, and now this
-- column's own lineage-wide UPDATE) has been running with no index to use.
CREATE INDEX IF NOT EXISTS idx_assets_asset_group_id ON assets (asset_group_id);
