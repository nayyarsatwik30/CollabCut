-- ============================================================================
-- Performance indexes flagged by the scalability audit (confirmed missing
-- via pg_indexes). These foreign-key lookups were falling back to
-- sequential scans - the main driver behind 10-13s Project/Board loads.
-- ============================================================================

create index if not exists comments_asset_id_idx on comments (asset_id);
create index if not exists replies_comment_id_idx on replies (comment_id);
create index if not exists assets_project_id_idx on assets (project_id);
create index if not exists projects_owner_id_idx on projects (owner_id);
