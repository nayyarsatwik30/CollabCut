-- Project brief: fallback shown on the review screen for assets with no brief
-- of their own. Idempotent - safe to run more than once.
-- Take a fresh backup before running.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS brief_notes text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brief_reference text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brief_deadline date;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brief_drive_link text;
