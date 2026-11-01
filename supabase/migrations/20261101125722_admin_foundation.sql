-- Foundation for the admin dashboard. The one admin account carries
-- app_metadata.role = 'admin', which players can't edit. Admin writes go through
-- security definer admin_* functions, and each one records itself in admin_actions.

create function public.is_admin()
  returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Answers "why did this change?" target_id has no foreign key so the record
-- outlives what it describes. The reason is empty only for ordinary club edits.
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  action text not null check (char_length(btrim(action)) > 0),
  target_type text not null check (char_length(btrim(target_type)) > 0),
  target_id text not null,
  before jsonb,
  after jsonb,
  reason text check (char_length(btrim(reason)) > 0),
  created_at timestamptz not null default now()
);

create index admin_actions_created_at_idx on public.admin_actions (created_at desc);
create index admin_actions_target_idx
  on public.admin_actions (target_type, target_id, created_at desc);

alter table public.admin_actions enable row level security;

revoke all on public.admin_actions from anon, authenticated;
grant select on public.admin_actions to authenticated;

create policy "Admins read admin actions"
  on public.admin_actions for select to authenticated
  using ((select public.is_admin()));

-- The first line of every admin_* function
create function public.assert_admin()
  returns void
  language plpgsql
  stable
  set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
end;
$$;

revoke all on function public.assert_admin() from public, anon, authenticated;

-- Called from admin_* functions only; they run with the owner's rights
create function public.log_admin_action(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_before jsonb,
  p_after jsonb,
  p_reason text
)
  returns void
  language sql
  set search_path = ''
as $$
  insert into public.admin_actions (admin_id, action, target_type, target_id, before, after, reason)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_before, p_after, nullif(btrim(p_reason), ''));
$$;

revoke all on function public.log_admin_action(text, text, text, jsonb, jsonb, text)
  from public, anon, authenticated;

-- The other tables are already readable by every signed-in player
create policy "Admins read every profile"
  on public.profiles for select to authenticated
  using ((select public.is_admin()));

create policy "Admins read every connection"
  on public.connections for select to authenticated
  using ((select public.is_admin()));
