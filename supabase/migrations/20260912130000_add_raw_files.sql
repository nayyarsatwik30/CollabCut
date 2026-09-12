-- ============================================================================
-- Raw footage archival (Backblaze B2) — a fully separate table/flow from the
-- Mux-backed `assets` table. B2 stores original camera files for archival
-- only; Mux still owns all review/playback. No versioning, no asset_group_id
-- concept here — flat list per project.
--
-- RLS follows the same coarse-backstop pattern as assets/projects/comments
-- (see 20260912120000_fix_stale_comments_replies_approvals_rls.sql): the
-- real, tighter check (admin-only) lives in the API routes via
-- lib/api-auth.ts, which always run on the service-role client and bypass
-- RLS entirely. isAssignedEditor/hasWorkspaceRole are TypeScript, not SQL,
-- so they can't be called from a policy — this policy only gates raw
-- direct/browser-side Supabase access, same as everywhere else.
-- ============================================================================

create table if not exists raw_files (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  uploaded_by     uuid not null references auth.users(id),
  file_name       text not null,
  b2_key          text not null,
  file_size_bytes bigint,
  content_type    text,
  created_at      timestamptz not null default now()
);

create index if not exists raw_files_project_id_idx on raw_files (project_id);

alter table raw_files enable row level security;

create policy "raw_files access" on raw_files
for all
using (
  project_id in (
    select p.id
    from projects p
    where p.owner_id = auth.uid()
       or (p.workspace_id is not null and is_workspace_member(p.workspace_id))
  )
);
