-- ============================================================================
-- S10: comments/replies/approvals RLS policies still granted access via
-- project_members, a table confirmed always-empty (superseded by
-- workspace_members + asset_editors) - so in practice these policies never
-- actually matched on that branch, leaving only the owner_id fallback live.
-- Bring them in line with the workspace-membership check assets/projects
-- already use (is_workspace_member(workspace_id)), replacing the dead
-- project_members lookup.
--
-- Note: RLS is a coarse backstop here, same as on assets/projects - the
-- app's real, tighter authorization (admin vs. specifically assigned
-- editor) is enforced in the API routes via lib/api-auth.ts, which always
-- runs on the service-role client and bypasses RLS entirely. These policies
-- only matter if something ever queries these tables with the anon key.
-- ============================================================================

drop policy if exists "comment access" on comments;
create policy "comment access" on comments
for all
using (
  asset_id in (
    select a.id
    from assets a
    join projects p on p.id = a.project_id
    where p.owner_id = auth.uid()
       or (p.workspace_id is not null and is_workspace_member(p.workspace_id))
  )
);

drop policy if exists "reply access" on replies;
create policy "reply access" on replies
for all
using (
  comment_id in (
    select c.id
    from comments c
    join assets a on a.id = c.asset_id
    join projects p on p.id = a.project_id
    where p.owner_id = auth.uid()
       or (p.workspace_id is not null and is_workspace_member(p.workspace_id))
  )
);

drop policy if exists "approval access" on approvals;
create policy "approval access" on approvals
for all
using (
  asset_id in (
    select a.id
    from assets a
    join projects p on p.id = a.project_id
    where p.owner_id = auth.uid()
       or (p.workspace_id is not null and is_workspace_member(p.workspace_id))
  )
);
