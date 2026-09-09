-- ============================================================================
-- Workspace invite codes
--
-- Adds a short, unique, human-shareable code to each workspace so a new
-- signup can join it directly (Editor path) without an email-bound invite
-- link. Generated immediately for every workspace (existing rows included),
-- never generated later on demand.
-- ============================================================================

create or replace function generate_workspace_invite_code()
returns text
language sql
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

alter table workspaces
  add column if not exists invite_code text;

update workspaces
  set invite_code = generate_workspace_invite_code()
  where invite_code is null;

alter table workspaces
  alter column invite_code set default generate_workspace_invite_code(),
  alter column invite_code set not null;

create unique index if not exists workspaces_invite_code_idx on workspaces (invite_code);
