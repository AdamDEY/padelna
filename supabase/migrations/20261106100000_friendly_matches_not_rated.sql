-- Only competitive matches are rated. Friendly ones are played for fun, so nobody rates
-- anyone and their levels never change.
--
-- Ratings stay stored as given, but they don't move levels yet: c_rating_step is 0 until
-- the coaches agree how much each rating should count. Then set it here (with c_min_raters
-- and c_max_change) and, if wanted, recompute past matches from player_ratings.

create or replace function public.settle_match_levels(p_match_id uuid)
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
  -- Level change per point of the average rating (-2 to +2). 0 until the coaches agree on it:
  -- ratings are stored, but only results move levels.
  c_rating_step constant numeric := 0;
  -- Fewer raters than this and the ratings don't count, so one player can't move a level
  c_min_raters constant int := 2;
  -- Most one match can move a level, either way
  c_max_change constant numeric := 0.3;
begin
  select * into v_score from public.match_scores where match_id = p_match_id for update;
  if not found or v_score.status <> 'confirmed' or v_score.levels_settled_at is not null then
    return;
  end if;

  select * into v_match from public.matches where id = p_match_id;

  -- Friendly matches have no ratings and never change a level, so there's nothing to wait for
  if v_match.kind <> 'competitive' or v_match.status <> 'open' then
    update public.match_scores set levels_settled_at = now() where match_id = p_match_id;
    return;
  end if;

  if now() < v_score.confirmed_at + c_rating_window
     and (select count(distinct rater_id) from public.player_ratings where match_id = p_match_id)
         < (select count(*) from public.match_players where match_id = p_match_id) then
    return;
  end if;

  update public.match_scores set levels_settled_at = now() where match_id = p_match_id;

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

create or replace function public.submit_ratings(p_match_id uuid, p_player_ids uuid[], p_ratings smallint[])
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

  if v_match.kind <> 'competitive' then
    raise exception 'Friendly matches aren''t rated';
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

revoke all on function public.settle_match_levels(uuid) from public, anon, authenticated;
revoke all on function public.submit_ratings(uuid, uuid[], smallint[]) from public, anon;
grant execute on function public.submit_ratings(uuid, uuid[], smallint[]) to authenticated;
