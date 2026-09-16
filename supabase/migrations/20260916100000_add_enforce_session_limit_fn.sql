-- ============================================================================
-- Concurrent session limit for self-serve accounts
--
-- Atomically counts a user's active Supabase Auth sessions and deletes the
-- oldest ones beyond p_max_sessions. No-ops for agency workspace members -
-- self-serve is defined as workspaces.workspace_plan_id IS NULL (per the
-- workspace_plans migration: NULL = plain self-serve collaboration
-- workspace, NOT NULL = an agency workspace on an assigned tier).
-- ============================================================================

create or replace function public.enforce_session_limit(p_user_id uuid, p_max_sessions int default 2)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_is_self_serve boolean;
begin
  select exists (
    select 1
    from workspace_members wm
    join workspaces w on w.id = wm.workspace_id
    where wm.user_id = p_user_id
      and w.workspace_plan_id is null
  ) into v_is_self_serve;

  if not v_is_self_serve then
    return;
  end if;

  delete from auth.sessions
  where id in (
    select id
    from auth.sessions
    where user_id = p_user_id
      and (not_after is null or not_after > now())
    order by created_at desc
    offset p_max_sessions
  );
end;
$$;

revoke all on function public.enforce_session_limit(uuid, int) from public, anon, authenticated;
grant execute on function public.enforce_session_limit(uuid, int) to service_role;
