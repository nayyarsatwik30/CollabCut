-- ============================================================================
-- Drop the legacy email-link invite system.
--
-- Editors now join a workspace via the invite code on `workspaces`
-- (see 20260908020000_add_workspace_invite_code.sql), and reviewers use
-- share links (`share_links`). Neither depends on the `invites` table, so
-- it and its policies are dropped here.
-- ============================================================================

drop policy if exists "workspace_admins_can_view_invites" on invites;
drop policy if exists "workspace_admins_can_create_invites" on invites;

drop table if exists invites;
