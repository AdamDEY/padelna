-- Players report someone for sabotaging a match, a fake score, rude behaviour...: a reason from a
-- fixed list and an optional comment. Reports are confidential: the reported player never sees
-- them, and only admins can read them (the admin dashboard reviews them).

create table public.player_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  -- What the reporter said: did they play a match with this player?
  played_together boolean not null,
  -- Keep in sync with src/data/report-reasons.ts
  reason text not null check (
    reason in ('sabotage', 'fake_score', 'unfair_rating', 'wrong_level', 'no_show', 'abusive', 'other')
  ),
  comment text not null default '' check (char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

create index player_reports_reported_idx on public.player_reports (reported_id, created_at desc);
create index player_reports_reporter_idx on public.player_reports (reporter_id, created_at desc);

alter table public.player_reports enable row level security;

-- Writes go through report_player only
revoke all on public.player_reports from anon, authenticated;
grant select on public.player_reports to authenticated;

create policy "Admins read player reports"
  on public.player_reports for select to authenticated
  using ((select public.is_admin()));

-- Report a player. Sending the same reason again within a day only keeps the first report, so a
-- double tap or a retry doesn't pile up copies.
create function public.report_player(
  p_player_id uuid,
  p_reason text,
  p_played_together boolean,
  p_comment text default ''
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_comment text := btrim(coalesce(p_comment, ''));
  -- How many reports one player can send in a day
  c_daily_limit constant int := 10;
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;

  if p_player_id = v_uid then
    raise exception 'You can''t report yourself';
  end if;

  if not exists (select 1 from public.profiles where id = p_player_id) then
    raise exception 'This player no longer exists';
  end if;

  if p_played_together is null then
    raise exception 'Say whether you played with this player';
  end if;

  if p_reason is null or p_reason not in (
    'sabotage', 'fake_score', 'unfair_rating', 'wrong_level', 'no_show', 'abusive', 'other'
  ) then
    raise exception 'Pick a reason from the list';
  end if;

  if char_length(v_comment) > 300 then
    raise exception 'Keep your comment under 300 characters';
  end if;

  if exists (
    select 1 from public.player_reports r
    where r.reporter_id = v_uid and r.reported_id = p_player_id and r.reason = p_reason
      and r.created_at > now() - interval '1 day'
  ) then
    return;
  end if;

  if (
    select count(*) from public.player_reports r
    where r.reporter_id = v_uid and r.created_at > now() - interval '1 day'
  ) >= c_daily_limit then
    raise exception 'You''ve sent a lot of reports today. Try again tomorrow.';
  end if;

  insert into public.player_reports (reporter_id, reported_id, played_together, reason, comment)
  values (v_uid, p_player_id, p_played_together, p_reason, v_comment);
end;
$$;

revoke all on function public.report_player(uuid, text, boolean, text) from public, anon;
grant execute on function public.report_player(uuid, text, boolean, text) to authenticated;
