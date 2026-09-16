-- ============================================================================
-- Agency workspace plan tiers
--
-- A lookup table mirroring the existing `plans` table pattern, but scoped to
-- workspaces instead of individual profiles. workspaces.workspace_plan_id is
-- nullable: NULL means "plain self-serve collaboration workspace" (the kind
-- any individual user already gets via Settings > Team today), not an
-- agency workspace. No admin/editor count enforcement here - that's a
-- separate pending decision. No price column - pricing isn't finalized yet.
-- ============================================================================

create table if not exists workspace_plans (
  id           text primary key,        -- 'tier_1' | 'tier_2'
  name         text not null,
  storage_gb   integer not null,
  max_admins   integer not null,
  max_editors  integer not null,
  sort_order   integer not null default 0
);

insert into workspace_plans (id, name, storage_gb, max_admins, max_editors, sort_order) values
  ('tier_1', 'Agency Tier 1', 1024, 2, 3, 1),
  ('tier_2', 'Agency Tier 2', 2048, 3, 4, 2)
on conflict (id) do nothing;

alter table workspaces
  add column if not exists workspace_plan_id text references workspace_plans(id);

create index if not exists workspaces_workspace_plan_id_idx on workspaces (workspace_plan_id);
