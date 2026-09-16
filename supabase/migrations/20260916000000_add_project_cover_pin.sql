-- Pins each project's Board/Dashboard card thumbnail to the first asset
-- (any cut_type) that ever finished Mux processing in it. Set once, in the
-- Mux webhook on video.asset.ready, and re-pinned only if that asset is
-- later soft-deleted - see lib/project-covers.ts.
alter table projects
  add column if not exists cover_asset_id uuid references assets(id) on delete set null,
  add column if not exists cover_playback_id text;

create index if not exists projects_cover_asset_id_idx on projects (cover_asset_id);
