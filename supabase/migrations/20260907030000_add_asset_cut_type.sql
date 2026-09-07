-- ============================================================================
-- Custom Cut / Board Cut split
--
-- Adds: assets.cut_type - 'board' assets go through the existing
-- versioning/pipeline_status/review flow; 'custom' assets are simple
-- one-off uploads with no versioning UI. Defaults to 'board' so every
-- existing asset and upload path keeps behaving exactly as it does today.
-- ============================================================================

alter table assets
  add column if not exists cut_type text not null default 'board';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'assets_cut_type_check'
  ) then
    alter table assets
      add constraint assets_cut_type_check
      check (cut_type in ('custom', 'board'));
  end if;
end $$;

create index if not exists assets_cut_type_idx on assets (cut_type);
