-- Players rate each other after a match, and competitive matches move levels.
--
-- Once the host has saved a score, each player says how every other player played
-- compared to the level on their profile (-2 well below ... +2 well above). Ratings are
-- anonymous: a player reads only the ratings they gave, never who rated them.
--
-- A competitive match changes levels once its score is confirmed and everyone has rated,
-- or 3 days after confirmation at the latest: an Elo-style step from the result against the
-- other team's level, plus a smaller nudge from the ratings when at least 2 players rated.
-- Friendly matches and scores that expire never change a level.

-- Exact level behind the 0.1 steps shown in the app, so small changes add up over matches
alter table public.profiles add column level_points numeric(5, 3) check (level_points between 1 and 7);

alter table public.profiles disable trigger profiles_set_updated_at;
update public.profiles set level_points = level where level is not null;
alter table public.profiles enable trigger profiles_set_updated_at;

-- A level set any other way (the quiz, an admin) resets the exact value under it.
-- Named to run after profiles_protect_columns, which may put the old level back.
create function public.sync_level_points()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.level_points := new.level;
  elsif new.level is distinct from old.level
        and new.level_points is not distinct from old.level_points then
    new.level_points := new.level;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_level_points() from public, anon, authenticated;

create trigger profiles_sync_level_points
  before insert or update of level on public.profiles
  for each row execute function public.sync_level_points();

-- settle_match_levels marks its changes so level_history records them as 'match'
create or replace function public.record_level_change()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_is_match boolean := coalesce(current_setting('padelna.level_cause', true), '') = 'match';
begin
  insert into public.level_history (player_id, old_level, new_level, cause, match_id)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.level end,
    new.level,
    case
      when tg_op = 'INSERT' or old.level is null then 'quiz'
      when v_is_match then 'match'
      else 'admin'
    end,
    case when v_is_match then nullif(current_setting('padelna.level_match_id', true), '')::uuid end
  );
  return null;
end;
$$;

create table public.player_ratings (
  match_id uuid not null references public.matches (id) on delete cascade,
  rater_id uuid not null references public.profiles (id) on delete cascade,
  rated_id uuid not null references public.profiles (id) on delete cascade,
  -- How they played compared to their profile level: -2 well below ... +2 well above
  rating smallint not null check (rating between -2 and 2),
  created_at timestamptz not null default now(),
  primary key (match_id, rater_id, rated_id),
  check (rater_id <> rated_id)
);

create index player_ratings_rated_idx on public.player_ratings (rated_id);

alter table public.player_ratings enable row level security;

-- Writes go through submit_ratings only
revoke all on public.player_ratings from anon, authenticated;
grant select on public.player_ratings to authenticated;

-- So the app knows you've rated. Nobody reads who rated them.
create policy "Players read the ratings they gave"
  on public.player_ratings for select to authenticated
  using ((select auth.uid()) = rater_id);

-- Unfair ratings can get an account banned, so admins can review them
create policy "Admins read ratings"
  on public.player_ratings for select to authenticated
  using ((select public.is_admin()));

-- Set once a match's level changes are done (or it turned out to have none)
alter table public.match_scores add column levels_settled_at timestamptz;

-- Scores confirmed before ratings existed keep the levels they have
update public.match_scores set levels_settled_at = confirmed_at where status = 'confirmed';

-- What each competitive match did to each level, so a change can be explained or undone
create table public.match_level_changes (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  old_points numeric(5, 3) not null,
  new_points numeric(5, 3) not null,
  result_change numeric(5, 3) not null,
  rating_change numeric(5, 3) not null,
  rating_count smallint not null,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

alter table public.match_level_changes enable row level security;

revoke all on public.match_level_changes from anon, authenticated;
grant select on public.match_level_changes to authenticated;

create policy "Admins read match level changes"
  on public.match_level_changes for select to authenticated
  using ((select public.is_admin()));

-- Applies a confirmed competitive match to its players' levels, once. Does nothing until
-- every player has rated or the rating window has closed.
create function public.settle_match_levels(p_match_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_score public.match_scores%rowtype;
  -- By seat, 1-4
  v_levels numeric[] := array_fill(null::numeric, array[4]);
  v_ids uuid[] := array_fill(null::uuid, array[4]);
  v_team1_sets int := 0;
  v_winner smallint;
  v_team smallint;
  v_mine numeric;
  v_theirs numeric;
  v_expected numeric;
  v_result_change numeric;
  v_rating_change numeric;
  v_rating_count int;
  v_rating_avg numeric;
  v_new numeric;
  v_seat record;
  -- Same as submit_ratings
  c_rating_window constant interval := interval '3 days';
  -- Elo-style: a team this many levels stronger is expected to win 10 times out of 11
  c_scale constant numeric := 1.0;
  -- Most a result can move a level (a win you were sure to lose)
  c_result_step constant numeric := 0.2;
  -- Level change per point of the average rating (-2 to +2)
  c_rating_step constant numeric := 0.05;
  -- Fewer raters than this and the ratings don't count, so one player can't move a level
  c_min_raters constant int := 2;
  -- Most one match can move a level, either way
  c_max_change constant numeric := 0.3;
begin
  select * into v_score from public.match_scores where match_id = p_match_id for update;
  if not found or v_score.status <> 'confirmed' or v_score.levels_settled_at is not null then
    return;
  end if;

  if now() < v_score.confirmed_at + c_rating_window
     and (select count(distinct rater_id) from public.player_ratings where match_id = p_match_id)
         < (select count(*) from public.match_players where match_id = p_match_id) then
    return;
  end if;

  update public.match_scores set levels_settled_at = now() where match_id = p_match_id;

  select * into v_match from public.matches where id = p_match_id;
  if v_match.kind <> 'competitive' or v_match.status <> 'open' then
    return;
  end if;

  for i in 1..coalesce(array_length(v_score.team1_games, 1), 0) loop
    if v_score.team1_games[i] > v_score.team2_games[i] then
      v_team1_sets := v_team1_sets + 1;
    end if;
  end loop;
  v_winner := case when v_team1_sets = 2 then 1 else 2 end;

  -- The host's guests aren't on the app; they count at the middle of the match's level range
  for i in 1..4 loop
    v_levels[i] := (v_match.level_min + v_match.level_max) / 2;
  end loop;
  for v_seat in
    select mp.seat, mp.player_id, coalesce(p.level_points, p.level) as points
    from public.match_players mp
    join public.profiles p on p.id = mp.player_id
    where mp.match_id = p_match_id
  loop
    v_ids[v_seat.seat] := v_seat.player_id;
    if v_seat.points is not null then
      v_levels[v_seat.seat] := v_seat.points;
    end if;
  end loop;

  perform set_config('padelna.level_cause', 'match', true);
  perform set_config('padelna.level_match_id', p_match_id::text, true);

  for i in 1..4 loop
    continue when v_ids[i] is null;

    v_team := case when i <= 2 then 1 else 2 end;
    v_mine := case when v_team = 1 then (v_levels[1] + v_levels[2]) / 2 else (v_levels[3] + v_levels[4]) / 2 end;
    v_theirs := case when v_team = 1 then (v_levels[3] + v_levels[4]) / 2 else (v_levels[1] + v_levels[2]) / 2 end;
    v_expected := 1 / (1 + power(10::numeric, (v_theirs - v_mine) / c_scale));
    v_result_change := c_result_step * ((case when v_team = v_winner then 1 else 0 end) - v_expected);

    select count(*), avg(rating) into v_rating_count, v_rating_avg
    from public.player_ratings
    where match_id = p_match_id and rated_id = v_ids[i];
    v_rating_change := case when v_rating_count >= c_min_raters then v_rating_avg * c_rating_step else 0 end;

    v_new := v_levels[i]
      + greatest(-c_max_change, least(c_max_change, v_result_change + v_rating_change));
    v_new := round(greatest(1, least(7, v_new)), 3);

    insert into public.match_level_changes (
      match_id, player_id, old_points, new_points, result_change, rating_change, rating_count
    )
    values (
      p_match_id, v_ids[i], v_levels[i], v_new,
      round(v_result_change, 3), round(v_rating_change, 3), v_rating_count
    );

    update public.profiles
    set level_points = v_new, level = round(v_new, 1)
    where id = v_ids[i];
  end loop;

  perform set_config('padelna.level_cause', '', true);
  perform set_config('padelna.level_match_id', '', true);
end;
$$;

revoke all on function public.settle_match_levels(uuid) from public, anon, authenticated;

-- Rates the other players in a match, all at once. Ratings can't be changed afterwards.
-- Rating opens once the host saved a score and closes 3 days after it's confirmed.
create function public.submit_ratings(p_match_id uuid, p_player_ids uuid[], p_ratings smallint[])
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_score public.match_scores%rowtype;
  v_count int := coalesce(array_length(p_player_ids, 1), 0);
  -- Same as settle_match_levels
  c_rating_window constant interval := interval '3 days';
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;

  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'This match no longer exists';
  end if;
  if v_match.status <> 'open' then
    raise exception 'This match was cancelled';
  end if;

  if not exists (select 1 from public.match_players where match_id = p_match_id and player_id = v_uid) then
    raise exception 'Only players in this match can rate it';
  end if;

  select * into v_score from public.match_scores where match_id = p_match_id;
  if not found then
    raise exception 'You can rate the players once the score is added';
  end if;
  if v_score.status = 'pending' and now() > v_score.expires_at then
    raise exception 'This score wasn''t confirmed in time, so the match can''t be rated';
  end if;
  if v_score.status = 'confirmed' and now() > v_score.confirmed_at + c_rating_window then
    raise exception 'It''s too late to rate this match';
  end if;

  if exists (select 1 from public.player_ratings where match_id = p_match_id and rater_id = v_uid) then
    raise exception 'You already rated this match';
  end if;

  if v_count = 0 or coalesce(array_length(p_ratings, 1), 0) <> v_count then
    raise exception 'Rate at least one player';
  end if;
  if (select count(distinct id) from unnest(p_player_ids) as id) <> v_count then
    raise exception 'Each player can be rated once';
  end if;
  if v_uid = any (p_player_ids) then
    raise exception 'You can''t rate yourself';
  end if;
  if exists (select 1 from unnest(p_ratings) as r where r is null or r not between -2 and 2) then
    raise exception 'Pick a rating for each player';
  end if;
  if (select count(*) from public.match_players where match_id = p_match_id and player_id = any (p_player_ids))
     <> v_count then
    raise exception 'You can only rate players from this match';
  end if;

  insert into public.player_ratings (match_id, rater_id, rated_id, rating)
  select p_match_id, v_uid, rated.id, rated.rating
  from unnest(p_player_ids, p_ratings) as rated (id, rating);

  -- The last player to rate can settle the levels right away
  perform public.settle_match_levels(p_match_id);
end;
$$;

revoke all on function public.submit_ratings(uuid, uuid[], smallint[]) from public, anon;
grant execute on function public.submit_ratings(uuid, uuid[], smallint[]) to authenticated;

-- Same as before, plus settling the levels when everyone rated before the score was confirmed
create or replace function public.confirm_score(p_match_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_seat smallint;
  v_score public.match_scores%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;

  select * into v_score from public.match_scores where match_id = p_match_id for update;
  if not found then
    raise exception 'There''s no score to confirm yet';
  end if;
  if v_score.status = 'confirmed' then
    raise exception 'This score is already confirmed';
  end if;
  if now() > v_score.expires_at then
    raise exception 'This score wasn''t confirmed in time';
  end if;

  select seat into v_seat from public.match_players where match_id = p_match_id and player_id = v_uid;
  if not found then
    raise exception 'Only players in this match can confirm its score';
  end if;
  if (case when v_seat <= 2 then 1 else 2 end) = v_score.submitted_team then
    raise exception 'A player from the other team confirms this score';
  end if;

  update public.match_scores
  set status = 'confirmed', confirmed_by = v_uid, confirmed_at = now()
  where match_id = p_match_id;

  perform public.settle_match_levels(p_match_id);
end;
$$;

-- Matches where not everyone rated settle when the rating window closes
create function public.settle_due_match_levels()
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_match_id uuid;
begin
  for v_match_id in
    select match_id from public.match_scores
    where status = 'confirmed'
      and levels_settled_at is null
      and confirmed_at + interval '3 days' <= now()
    order by confirmed_at
  loop
    perform public.settle_match_levels(v_match_id);
  end loop;
end;
$$;

revoke all on function public.settle_due_match_levels() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('settle-match-levels', '*/15 * * * *', $$select public.settle_due_match_levels()$$);
