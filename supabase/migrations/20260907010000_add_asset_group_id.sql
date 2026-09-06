-- ============================================================================
-- Stable lineage identity for asset versions
--
-- Grouping/versioning previously keyed off assets.name, which breaks once a
-- new version is uploaded under a different filename (e.g. a re-export from
-- the review page's "Upload new version" flow) — the name column is meant to
-- reflect the actual uploaded filename, not double as a lineage key.
--
-- asset_group_id gives every version of the same logical video a shared,
-- filename-independent id: the original upload is the head of its own group
-- (asset_group_id = id), and every subsequent version copies the head's
-- asset_group_id instead of getting a new one.
-- ============================================================================

alter table assets
  add column if not exists asset_group_id uuid;

update assets
set asset_group_id = id
where asset_group_id is null;

create index if not exists assets_asset_group_id_idx on assets (asset_group_id);
