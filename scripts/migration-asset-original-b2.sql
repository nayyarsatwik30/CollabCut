-- Keeps the exact uploaded file in Backblaze B2 so Download can return the
-- original instead of Mux's re-encoded rendition. Additive and idempotent -
-- safe to run more than once, and safe to apply BEFORE the code that uses it
-- deploys. original_b2_key stays NULL until the B2 upload has fully completed;
-- NULL always means "no original, serve the capped-1080p rendition".
-- Take a fresh backup (node scripts/db-backup/backup.js) before running.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS original_b2_key text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS original_file_name text;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS original_content_type text;
