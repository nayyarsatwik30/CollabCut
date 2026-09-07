-- ============================================================================
-- Trim the Kanban board to 5 columns
--
-- Drops 'scripting' and 'filming' from assets.pipeline_status (confirmed zero
-- rows use either value in production before this migration was written).
-- 'idea' is kept as the stored value for the "Assigned Cut" column - only the
-- board UI label changes, not the data.
-- ============================================================================

alter table assets drop constraint if exists assets_pipeline_status_check;

alter table assets
  add constraint assets_pipeline_status_check
  check (pipeline_status in ('idea', 'editing', 'review', 'revision', 'approved'));
