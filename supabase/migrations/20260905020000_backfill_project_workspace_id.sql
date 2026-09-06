-- ============================================================================
-- Backfill workspace_id on legacy projects
--
-- Projects created before the multi-tenancy migration have workspace_id = NULL,
-- which makes them (and their assets) invisible to workspace-scoped views like
-- /board — the board query inner-joins assets -> projects on workspace_id, so
-- a NULL there correctly excludes the row even though the asset data is fine.
--
-- This sets workspace_id to the workspace where the project's owner holds a
-- membership (preferring their admin membership if they belong to more than
-- one workspace, then earliest joined_at as a tiebreak). owner_id already
-- points at profiles(id), which is the same id used in workspace_members.user_id,
-- so no join through profiles is actually needed beyond that.
--
-- NOTE: a project whose owner has NO workspace_members row at all is left
-- untouched (there's nothing to backfill to). The final SELECT lists those
-- so they can be handled manually (e.g. add that owner to a workspace, then
-- re-run this migration).
-- ============================================================================

with owner_workspace as (
  select distinct on (user_id)
    user_id,
    workspace_id
  from workspace_members
  order by user_id, (role = 'admin') desc, joined_at asc
)
update projects p
set workspace_id = ow.workspace_id
from owner_workspace ow
where p.workspace_id is null
  and p.owner_id = ow.user_id;

-- Projects still left with a NULL workspace_id after the backfill (owner has
-- no workspace membership anywhere) — review these manually.
select id, name, owner_id
from projects
where workspace_id is null;
