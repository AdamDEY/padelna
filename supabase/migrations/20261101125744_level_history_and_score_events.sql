-- History the dashboard and its stats need. Both tables fill themselves from triggers,
-- so nothing changes in the app, and only admins can read them.

-- Every level change. Competitive matches will change levels once that's built; until then
-- nothing writes 'match'. The quiz is mocked to level 6 for now, and still counts as 'quiz'.
create table public.level_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  old_level numeric(2, 1),
  new_level numeric(2, 1),
  cause text not null check (cause in ('quiz', 'match', 'admin')),
  match_id uuid references public.matches (id) on delete set null,
  created_at timestamptz not null default now()
);

create index level_history_player_idx on public.level_history (player_id, created_at desc);

alter table public.level_history enable row level security;

revoke all on public.level_history from anon, authenticated;
grant select on public.level_history to authenticated;

create policy "Admins read level history"
  on public.level_history for select to authenticated
  using ((select public.is_admin()));

-- The first level comes from profile setup. After that, players can't change it
-- (see protect_profile_columns), so today any later change is an admin's. The level
-- calculation for competitive matches must tell this trigger when the cause is 'match'.
create function public.record_level_change()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.level_history (player_id, old_level, new_level, cause)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.level end,
    new.level,
    case when tg_op = 'INSERT' or old.level is null then 'quiz' else 'admin' end
  );
  return null;
end;
$$;

revoke all on function public.record_level_change() from public, anon, authenticated;

create trigger profiles_record_level_insert
  after insert on public.profiles
  for each row when (new.level is not null)
  execute function public.record_level_change();

create trigger profiles_record_level_update
  after update of level on public.profiles
  for each row when (old.level is distinct from new.level)
  execute function public.record_level_change();

-- Every step of a score. submit_score overwrites match_scores, so this is the only
-- record of a correction. 'expire' is never written: a score expires by its date.
create table public.score_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  event text not null
    check (event in ('submit', 'correct', 'confirm', 'expire', 'admin_set', 'reopen', 'void')),
  -- No foreign key, so the record stays when the player's account is gone
  actor_id uuid,
  team1_games smallint[],
  team2_games smallint[],
  submitted_team smallint,
  created_at timestamptz not null default now()
);

create index score_events_match_idx on public.score_events (match_id, created_at);
create index score_events_created_at_idx on public.score_events (created_at desc);

alter table public.score_events enable row level security;

revoke all on public.score_events from anon, authenticated;
grant select on public.score_events to authenticated;

create policy "Admins read score events"
  on public.score_events for select to authenticated
  using ((select public.is_admin()));

create function public.record_score_event()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_event text;
  v_actor uuid;
begin
  if tg_op = 'INSERT' then
    v_event := 'submit';
    v_actor := new.submitted_by;
  elsif old.status = 'pending' and new.status = 'confirmed' then
    v_event := 'confirm';
    v_actor := new.confirmed_by;
  elsif new.submitted_at is distinct from old.submitted_at then
    v_event := case when new.submitted_team <> old.submitted_team then 'correct' else 'submit' end;
    v_actor := new.submitted_by;
  else
    -- Not a score step, e.g. adding the team photo
    return null;
  end if;

  insert into public.score_events (match_id, event, actor_id, team1_games, team2_games, submitted_team)
  values (new.match_id, v_event, v_actor, new.team1_games, new.team2_games, new.submitted_team);
  return null;
end;
$$;

revoke all on function public.record_score_event() from public, anon, authenticated;

create trigger match_scores_record_event
  after insert or update on public.match_scores
  for each row execute function public.record_score_event();

-- What can be recovered for existing rows. Corrections before today were overwritten.
insert into public.level_history (player_id, old_level, new_level, cause, created_at)
select id, null, level, 'quiz', created_at
from public.profiles
where level is not null;

insert into public.score_events (match_id, event, actor_id, team1_games, team2_games, submitted_team, created_at)
select match_id, 'submit', submitted_by, team1_games, team2_games, submitted_team, submitted_at
from public.match_scores;

insert into public.score_events (match_id, event, actor_id, team1_games, team2_games, submitted_team, created_at)
select match_id, 'confirm', confirmed_by, team1_games, team2_games, submitted_team, confirmed_at
from public.match_scores
where status = 'confirmed';
