-- ============================================================================
-- Kanban pipeline status for assets
--
-- Adds: assets.pipeline_status (drives the /board Kanban columns)
-- ============================================================================

alter table assets
  add column if not exists pipeline_status text not null default 'idea';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assets_pipeline_status_check'
  ) then
    alter table assets
      add constraint assets_pipeline_status_check
      check (pipeline_status in ('idea', 'scripting', 'filming', 'editing', 'review', 'revision', 'approved'));
  end if;
end $$;

create index if not exists assets_pipeline_status_idx on assets (pipeline_status);
