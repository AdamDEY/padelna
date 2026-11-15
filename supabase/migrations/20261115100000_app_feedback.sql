-- Feedback players send by shaking their phone: a bug, an idea or something else, with a message.
-- Each row keeps who sent it (the profile id) and their full name as it was when they sent it, so the
-- team can answer even if the player later renames or deletes their account. Only admins can read
-- feedback (the admin dashboard lists it).

create table public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  -- Set to null if the player deletes their account; sender_name stays
  sender_id uuid references public.profiles (id) on delete set null,
  sender_name text not null,
  -- Keep in sync with src/data/feedback-kinds.ts
  kind text not null check (kind in ('bug', 'idea', 'other')),
  message text not null check (char_length(message) between 1 and 500),
  -- Where the player was in the app, e.g. /matches
  screen text not null default '',
  app_version text not null default '',
  platform text not null default '',
  created_at timestamptz not null default now()
);

create index app_feedback_created_idx on public.app_feedback (created_at desc);
create index app_feedback_sender_idx on public.app_feedback (sender_id, created_at desc);

alter table public.app_feedback enable row level security;

-- Writes go through submit_feedback only
revoke all on public.app_feedback from anon, authenticated;
grant select on public.app_feedback to authenticated;

create policy "Admins read feedback"
  on public.app_feedback for select to authenticated
  using ((select public.is_admin()));

-- Send feedback. The sender's id and name come from the signed-in profile, never from the app, so
-- nobody can send feedback in someone else's name.
create function public.submit_feedback(
  p_kind text,
  p_message text,
  p_screen text default '',
  p_app_version text default '',
  p_platform text default ''
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_message text := btrim(coalesce(p_message, ''));
  v_name text;
  -- How many messages one player can send in a day
  c_daily_limit constant int := 10;
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;

  if p_kind is null or p_kind not in ('bug', 'idea', 'other') then
    raise exception 'Pick a type from the list';
  end if;

  if v_message = '' then
    raise exception 'Write your message first';
  end if;

  if char_length(v_message) > 500 then
    raise exception 'Keep your message under 500 characters';
  end if;

  select btrim(first_name || ' ' || last_name) into v_name
  from public.profiles
  where id = v_uid;

  if v_name is null then
    raise exception 'Finish your profile first';
  end if;

  if (
    select count(*) from public.app_feedback f
    where f.sender_id = v_uid and f.created_at > now() - interval '1 day'
  ) >= c_daily_limit then
    raise exception 'You''ve sent a lot of feedback today. Try again tomorrow.';
  end if;

  insert into public.app_feedback (sender_id, sender_name, kind, message, screen, app_version, platform)
  values (
    v_uid,
    v_name,
    p_kind,
    v_message,
    left(coalesce(p_screen, ''), 100),
    left(coalesce(p_app_version, ''), 30),
    left(coalesce(p_platform, ''), 30)
  );
end;
$$;

revoke all on function public.submit_feedback(text, text, text, text, text) from public, anon;
grant execute on function public.submit_feedback(text, text, text, text, text) to authenticated;
