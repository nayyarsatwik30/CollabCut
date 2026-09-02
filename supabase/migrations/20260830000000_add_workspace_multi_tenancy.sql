-- ============================================================================
-- Multi-tenant workspace support
--
-- Adds: workspaces, workspace_members, asset_editors, invites
-- Alters: projects (+ workspace_id), assets (+ completion tracking)
--
-- Notes:
--   * All new tables get RLS enabled per spec.
--   * The new SELECT policies on `projects` / `assets` are ADDITIVE — Postgres
--     OR's together multiple permissive policies for the same command, so any
--     pre-existing policies on those tables keep working unchanged. Existing
--     rows have workspace_id = NULL until backfilled/assigned, so they simply
--     won't be reachable through the new workspace-scoped policy until then.
--   * `is_workspace_member` / `is_workspace_admin` are SECURITY DEFINER helpers
--     so that policies on `workspace_members` itself don't recurse into RLS
--     when checking membership.
--   * The app currently reads/writes exclusively via the service-role client
--     (supabaseAdmin), which bypasses RLS entirely — these policies only
--     matter for any future direct/browser-side Supabase access.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. workspaces
-- ============================================================================

create table if not exists workspaces (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  owner_id   uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists workspaces_owner_id_idx on workspaces (owner_id);

-- ============================================================================
-- 2. workspace_members
-- ============================================================================

create table if not exists workspace_members (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  role         text not null check (role in ('admin', 'editor')),
  joined_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_workspace_id_idx on workspace_members (workspace_id);
create index if not exists workspace_members_user_id_idx on workspace_members (user_id);

-- ============================================================================
-- Helper functions (SECURITY DEFINER to avoid RLS recursion on workspace_members)
-- ============================================================================

create or replace function is_workspace_member(_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members
    where workspace_id = _workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function is_workspace_admin(_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members
    where workspace_id = _workspace_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- ============================================================================
-- 3. projects.workspace_id
-- ============================================================================

alter table projects
  add column if not exists workspace_id uuid references workspaces(id) on delete set null;

create index if not exists projects_workspace_id_idx on projects (workspace_id);

-- ============================================================================
-- 4. asset_editors (many-to-many: assets <-> editors)
-- ============================================================================

create table if not exists asset_editors (
  id           uuid primary key default uuid_generate_v4(),
  asset_id     uuid not null references assets(id) on delete cascade,
  editor_id    uuid not null references profiles(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  unique (asset_id, editor_id)
);

create index if not exists asset_editors_asset_id_idx on asset_editors (asset_id);
create index if not exists asset_editors_editor_id_idx on asset_editors (editor_id);

-- ============================================================================
-- 5. assets: completion tracking
-- ============================================================================

alter table assets
  add column if not exists is_complete boolean not null default false,
  add column if not exists marked_complete_by uuid references profiles(id),
  add column if not exists marked_complete_at timestamptz;

-- ============================================================================
-- 6. invites
-- ============================================================================

create table if not exists invites (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email        text not null,
  role         text not null check (role in ('admin', 'editor')),
  token        text not null unique default encode(gen_random_bytes(16), 'hex'),
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists invites_workspace_id_idx on invites (workspace_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table workspaces        enable row level security;
alter table workspace_members enable row level security;
alter table asset_editors     enable row level security;
alter table invites           enable row level security;

-- Also enable on the existing tables so the new workspace-scoped policies
-- actually take effect (no-op if RLS is already enabled on either table).
alter table projects enable row level security;
alter table assets   enable row level security;

-- ---- workspaces: visible only to members ----------------------------------

create policy "workspace_members_can_view_workspaces"
on workspaces for select
using ( is_workspace_member(id) );

-- ---- workspace_members: a member can see their workspace's roster --------

create policy "members_can_view_workspace_membership"
on workspace_members for select
using ( is_workspace_member(workspace_id) );

-- ---- projects: visible only to members of their workspace ----------------

create policy "workspace_members_can_view_projects"
on projects for select
using (
  workspace_id is not null
  and is_workspace_member(workspace_id)
);

-- ---- assets: visible only to members of the owning project's workspace ---

create policy "workspace_members_can_view_assets"
on assets for select
using (
  exists (
    select 1
    from projects p
    where p.id = assets.project_id
      and p.workspace_id is not null
      and is_workspace_member(p.workspace_id)
  )
);

-- ---- asset_editors: visible only to members of the asset's workspace -----

create policy "workspace_members_can_view_asset_editors"
on asset_editors for select
using (
  exists (
    select 1
    from assets a
    join projects p on p.id = a.project_id
    where a.id = asset_editors.asset_id
      and p.workspace_id is not null
      and is_workspace_member(p.workspace_id)
  )
);

-- ---- invites: only workspace admins can create invites for their own workspace ----

create policy "workspace_admins_can_create_invites"
on invites for insert
with check ( is_workspace_admin(workspace_id) );

-- Admins also need to be able to see the invites they create/manage; without
-- this, RLS blocks all reads and the invite list/revoke UI can't function.
create policy "workspace_admins_can_view_invites"
on invites for select
using ( is_workspace_admin(workspace_id) );
