-- Individual Americano from the app.
--
-- Players join alone (one tap, waitlist when full) or the organiser adds them from the dashboard.
-- Partners change every round, so entries are single players and the draw makes the teams at the
-- start; only confirmed players are drawn. The capacity is a multiple of 4.
--
-- Scores use the tournament's own mode (one set to 4 games, or a super tie-break to 10). A player in
-- the match enters it and it counts right away; any player in that match or the organiser can
-- correct it while the tournament is live. The leaderboard adds up each player's games or points.

alter table public.tournament_matches
  add column scored_by uuid references public.profiles (id) on delete set null;

-- Formats players can join from the app: group stage, and individual Americano
create function public.tournament_joinable_format(p_format text, p_settings jsonb)
  returns boolean
  language sql
  immutable
  set search_path = ''
as $$
  select p_format = 'groups' or (p_format = 'americano' and p_settings ->> 'entry_mode' = 'individual');
$$;

revoke all on function public.tournament_joinable_format(text, jsonb) from public, anon, authenticated;

-- Which side of a match a player is on: 1, 2, or null. Individual matches list the entries on each side.
create or replace function public.tournament_match_side(p_match public.tournament_matches, p_player_id uuid)
  returns smallint
  language sql
  stable
  set search_path = ''
as $$
  select case
    when exists (select 1 from public.tournament_entries e
                 where (e.id = p_match.entry1_id or e.id = any (coalesce(p_match.side1_players, '{}')))
                   and p_player_id in (e.player1_id, e.player2_id)) then 1
    when exists (select 1 from public.tournament_entries e
                 where (e.id = p_match.entry2_id or e.id = any (coalesce(p_match.side2_players, '{}')))
                   and p_player_id in (e.player1_id, e.player2_id)) then 2
  end::smallint;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reads: individual Americano can be joined, and the live view carries its rounds

create or replace function public.get_tournaments(p_limit integer default 50)
  returns table (
    id uuid, name text, format text, status text, category text, entry_mode text,
    starts_at timestamptz, club_name text, capacity integer, entries_count integer,
    spots_left integer, waitlist_count integer, registration_open boolean, my_status text
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select
    t.id, t.name, t.format, t.status, t.category, t.settings ->> 'entry_mode', t.starts_at, c.name,
    t.capacity::integer,
    case when t.status = 'setup' then public.tournament_spots_taken(t.id)
         else (select count(*)::integer from public.tournament_entries e where e.tournament_id = t.id) end,
    case when t.capacity is null or t.status <> 'setup' then null
         else greatest(t.capacity - public.tournament_spots_taken(t.id), 0) end,
    (select count(*)::integer from public.tournament_entries e
      where e.tournament_id = t.id and e.status in ('waitlist', 'waitlist_invited')
        and (e.invite_expires_at is null or e.invite_expires_at > now())),
    t.status = 'setup' and public.tournament_joinable_format(t.format, t.settings) and t.capacity is not null
      and (t.registration_closes_at is null or t.registration_closes_at > now())
      and (t.starts_at is null or t.starts_at > now()),
    (public.tournament_entry_of(t.id, auth.uid())).status
  from public.tournaments t
  left join public.clubs c on c.id = t.club_id
  where auth.uid() is not null
    and (
      t.status = 'live'
      or (t.status = 'setup' and (t.starts_at is null or t.starts_at > now() - interval '1 day'))
    )
  order by t.status = 'live' desc, t.starts_at nulls last, t.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.get_tournament(p_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_tournament public.tournaments%rowtype;
  v_mine public.tournament_entries%rowtype;
  v_taken integer;
  v_partner uuid;
begin
  if v_me is null then
    return null;
  end if;

  select * into v_tournament from public.tournaments where id = p_id;
  if not found then
    return null;
  end if;

  v_taken := public.tournament_spots_taken(p_id);

  v_mine := public.tournament_entry_of(p_id, v_me);
  v_partner := case when v_mine.player1_id = v_me then v_mine.player2_id else v_mine.player1_id end;

  return jsonb_build_object(
    'tournament', to_jsonb(v_tournament) || jsonb_build_object(
      'club_name', (select name from public.clubs where id = v_tournament.club_id),
      'club_city', (select city from public.clubs where id = v_tournament.club_id)
    ),
    'registration_open',
      public.tournament_joinable_format(v_tournament.format, v_tournament.settings) and v_tournament.status = 'setup' and v_tournament.capacity is not null
      and (v_tournament.registration_closes_at is null or v_tournament.registration_closes_at > now())
      and (v_tournament.starts_at is null or v_tournament.starts_at > now()),
    'entries_count', v_taken,
    'spots_left', case when v_tournament.capacity is null then null
                       else greatest(v_tournament.capacity - v_taken, 0) end,
    'waitlist_count', (
      select count(*) from public.tournament_entries e
      where e.tournament_id = p_id and e.status in ('waitlist', 'waitlist_invited')
        and (e.invite_expires_at is null or e.invite_expires_at > now())
    ),
    'looking_count', (
      select count(*) from public.tournament_entries e
      where e.tournament_id = p_id and e.status = 'looking'
    ),
    -- Why I can or can't join: ok, already_in_team, wrong_category, below_range, above_range
    'my_fit', public.tournament_player_fit(p_id, v_me),
    'my_level', (select level from public.profiles where id = v_me),
    'my_entry', case when v_mine.id is null then null else jsonb_build_object(
      'id', v_mine.id,
      'status', v_mine.status,
      -- 'captain' sent the invite (or is on the partner list), 'partner' received it
      'role', case when v_mine.player1_id = v_me then 'captain' else 'partner' end,
      'partner', public.tournament_player_json(v_partner),
      'invite_expires_at', v_mine.invite_expires_at
    ) end,
    'avg_level', (
      select round(avg(p.level), 2)
      from public.tournament_entries e
      join public.profiles p on p.id in (e.player1_id, e.player2_id)
      where e.tournament_id = p_id and e.status = 'confirmed'
    ),
    -- Pairs holding a spot, oldest first. 'invited' ones are waiting for the partner.
    'teams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'status', e.status,
          'joined_at', e.created_at,
          'name1', e.name1,
          'name2', e.name2,
          'player1', public.tournament_player_json(e.player1_id),
          'player2', public.tournament_player_json(e.player2_id),
          'team_level', (
            select round(avg(p.level), 2) from public.profiles p
            where p.id in (e.player1_id, e.player2_id)
          )
        )
        order by e.created_at, e.position
      )
      from public.tournament_entries e
      where e.tournament_id = p_id
        and (e.status = 'confirmed' or (e.status = 'invited' and e.invite_expires_at > now()))
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_tournament_live(p_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_tournament public.tournaments%rowtype;
begin
  if v_me is null then
    return null;
  end if;

  select * into v_tournament from public.tournaments where id = p_id;
  if not found or v_tournament.status = 'setup' then
    return null;
  end if;

  return jsonb_build_object(
    'tournament', jsonb_build_object(
      'id', v_tournament.id,
      'name', v_tournament.name,
      'format', v_tournament.format,
      'status', v_tournament.status,
      'category', v_tournament.category,
      'starts_at', v_tournament.starts_at,
      'group_count', (v_tournament.settings ->> 'group_count')::int,
      'entry_mode', v_tournament.settings ->> 'entry_mode',
      'score_mode', v_tournament.settings ->> 'score_mode',
      'rounds', (v_tournament.settings ->> 'rounds')::int,
      'club_id', v_tournament.club_id,
      'club_name', (select name from public.clubs where id = v_tournament.club_id),
      'organiser_name', v_tournament.organiser_name,
      'notes', v_tournament.notes
    ),
    'my_entry_id', (
      select e.id from public.tournament_entries e
      where e.tournament_id = p_id and v_me in (e.player1_id, e.player2_id)
      limit 1
    ),
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'name1', e.name1,
          'name2', e.name2,
          'group_label', e.group_label,
          'position', e.position,
          'player1', public.tournament_player_json(e.player1_id),
          'player2', public.tournament_player_json(e.player2_id)
        )
        order by e.group_label, e.position
      )
      from public.tournament_entries e
      where e.tournament_id = p_id
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'stage', m.stage,
          'group_label', m.group_label,
          'round', m.round,
          'label', m.label,
          'entry1_id', m.entry1_id,
          'entry2_id', m.entry2_id,
          'sets', m.sets,
          'super_tiebreak', m.super_tiebreak,
          'winner_entry_id', m.winner_entry_id,
          'next_match_id', m.next_match_id,
          'next_slot', m.next_slot,
          'side1_players', m.side1_players,
          'side2_players', m.side2_players,
          'winner_side', m.winner_side,
          'played_at', m.played_at,
          'scored_by_me', m.scored_by = v_me,
          'submitted_sets', case when m.winner_entry_id is null then m.submitted_sets end,
          'submitted_super_tiebreak', case when m.winner_entry_id is null then m.submitted_super_tiebreak end,
          'submitted_by_me', m.winner_entry_id is null and m.submitted_by = v_me,
          'my_side', public.tournament_match_side(m, v_me)
        )
        order by m.stage desc, m.round, m.group_label, m.label, m.id
      )
      from public.tournament_matches m
      where m.tournament_id = p_id
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Joining alone

create function public.join_tournament_solo(p_tournament_id uuid)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_tournament public.tournaments%rowtype;
  v_status text;
begin
  if v_me is null then
    raise exception 'Not signed in';
  end if;

  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'This tournament no longer exists';
  end if;
  if not (v_tournament.format = 'americano' and v_tournament.settings ->> 'entry_mode' = 'individual')
    or v_tournament.status <> 'setup'
    or v_tournament.capacity is null
    or v_tournament.registration_closes_at <= now()
    or v_tournament.starts_at <= now() then
    raise exception 'Registration for this tournament is closed';
  end if;
  perform public.tournament_refresh(p_tournament_id);

  case public.tournament_player_fit(p_tournament_id, v_me)
    when 'ok' then null;
    when 'already_in_team' then raise exception 'You are already in this tournament';
    when 'wrong_category' then raise exception 'This tournament is for another category';
    else raise exception 'Your level is outside this tournament''s range';
  end case;

  v_status := case when public.tournament_spots_taken(p_tournament_id) < v_tournament.capacity
                   then 'confirmed' else 'waitlist' end;

  insert into public.tournament_entries (tournament_id, name1, position, player1_id, status)
  values (
    p_tournament_id, public.tournament_player_name(v_me),
    public.tournament_next_position(p_tournament_id), v_me, v_status
  );
  return v_status;
end;
$$;

revoke all on function public.join_tournament_solo(uuid) from public, anon;
grant execute on function public.join_tournament_solo(uuid) to authenticated;

-- The organiser adds one app player to an individual Americano, confirmed straight away
create function public.admin_add_tournament_player(p_tournament_id uuid, p_player_id uuid)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_id uuid;
begin
  perform public.assert_admin();
  perform public.assert_tournament_setup(p_tournament_id);

  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  if not (v_tournament.format = 'americano' and v_tournament.settings ->> 'entry_mode' = 'individual') then
    raise exception 'Players are added one by one only in an individual Americano';
  end if;
  perform public.tournament_refresh(p_tournament_id);

  if not exists (select 1 from public.profiles where id = p_player_id) then
    raise exception 'This player no longer exists';
  end if;
  if public.tournament_player_fit(p_tournament_id, p_player_id) = 'already_in_team' then
    raise exception 'This player is already in the tournament';
  end if;
  if public.tournament_spots_taken(p_tournament_id) >= coalesce(v_tournament.capacity, 32) then
    raise exception 'This tournament is full';
  end if;

  insert into public.tournament_entries (tournament_id, name1, position, player1_id, status)
  values (
    p_tournament_id, public.tournament_player_name(p_player_id),
    public.tournament_next_position(p_tournament_id), p_player_id, 'confirmed'
  )
  returning id into v_id;

  perform public.tournament_notify(p_player_id, 'tournament_added', p_tournament_id);
  perform public.log_admin_action(
    'add_tournament_player', 'tournament', p_tournament_id::text, null,
    jsonb_build_object('entry_id', v_id, 'player', p_player_id), null
  );
  return v_id;
end;
$$;

revoke all on function public.admin_add_tournament_player(uuid, uuid) from public, anon;
grant execute on function public.admin_add_tournament_player(uuid, uuid) to authenticated;

create or replace function public.admin_set_tournament_registration(
  p_id uuid,
  p_capacity smallint,
  p_level_min numeric,
  p_level_max numeric,
  p_registration_closes_at timestamptz,
  p_ends_at timestamptz,
  p_entry_fee numeric,
  p_check_in_note text,
  p_prizes text,
  p_prizes_note text,
  p_organiser_name text,
  p_notes text
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_before public.tournaments%rowtype;
begin
  perform public.assert_admin();

  select * into v_before from public.tournaments where id = p_id for update;
  if not found then
    raise exception 'This tournament no longer exists';
  end if;
  if p_capacity is not null and p_capacity not between 6 and 32 then
    raise exception 'A tournament can have 6 to 32 pairs';
  end if;
  if v_before.settings ->> 'entry_mode' = 'individual' and p_capacity % 4 <> 0 then
    raise exception 'Use a multiple of 4 players, so everyone plays every round';
  end if;
  if p_capacity < (v_before.settings ->> 'group_count')::int * 3 then
    raise exception 'Every group needs at least 3 pairs, so raise the capacity or use fewer groups';
  end if;
  if p_capacity is not null and public.tournament_spots_taken(p_id) > p_capacity then
    raise exception 'More pairs have joined than that';
  end if;
  if p_level_min not between 1 and 7 or p_level_max not between 1 and 7 or p_level_min > p_level_max then
    raise exception 'Use a level range between 1 and 7';
  end if;
  if p_entry_fee < 0 then
    raise exception 'The entry fee can''t be negative';
  end if;
  if p_registration_closes_at > v_before.starts_at then
    raise exception 'Registration has to close before the tournament starts';
  end if;
  if p_ends_at <= v_before.starts_at then
    raise exception 'The tournament has to end after it starts';
  end if;

  update public.tournaments
  set capacity = p_capacity,
      level_min = p_level_min,
      level_max = p_level_max,
      registration_closes_at = p_registration_closes_at,
      ends_at = p_ends_at,
      entry_fee = p_entry_fee,
      check_in_note = nullif(btrim(coalesce(p_check_in_note, '')), ''),
      prizes = nullif(btrim(coalesce(p_prizes, '')), ''),
      prizes_note = nullif(btrim(coalesce(p_prizes_note, '')), ''),
      organiser_name = nullif(btrim(coalesce(p_organiser_name, '')), ''),
      notes = nullif(btrim(coalesce(p_notes, '')), '')
  where id = p_id;

  perform public.tournament_refresh(p_id);
  perform public.log_admin_action(
    'set_tournament_registration', 'tournament', p_id::text,
    jsonb_build_object('capacity', v_before.capacity, 'level_min', v_before.level_min, 'level_max', v_before.level_max),
    jsonb_build_object('capacity', p_capacity, 'level_min', p_level_min, 'level_max', p_level_max), null
  );
end;
$$;

create or replace function public.admin_start_individual(p_tournament_id uuid, p_matches jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_ids uuid[];
  v_count int;
  v_match jsonb;
  v_round int;
  v_in_match uuid[];
  v_rounds int := 0;
begin
  perform public.assert_admin();
  perform public.assert_tournament_setup(p_tournament_id);

  if not exists (
    select 1 from public.tournaments
    where id = p_tournament_id and format = 'americano' and settings ->> 'entry_mode' = 'individual'
  ) then
    raise exception 'This is not an individual Americano';
  end if;

  -- Only confirmed players take part; the waitlist ends here
  delete from public.tournament_entries where tournament_id = p_tournament_id and status <> 'confirmed';
  v_ids := array(select id from public.tournament_entries where tournament_id = p_tournament_id);
  v_count := coalesce(array_length(v_ids, 1), 0);
  if v_count < 4 or v_count % 4 <> 0 then
    raise exception 'The number of players must be a multiple of 4';
  end if;
  if jsonb_typeof(p_matches) <> 'array' or jsonb_array_length(p_matches) = 0 then
    raise exception 'Do the draw first';
  end if;

  for v_match in select * from jsonb_array_elements(p_matches) loop
    v_in_match := array[
      (v_match -> 'team1' ->> 0)::uuid, (v_match -> 'team1' ->> 1)::uuid,
      (v_match -> 'team2' ->> 0)::uuid, (v_match -> 'team2' ->> 1)::uuid
    ];
    if (select count(distinct x) from unnest(v_in_match) as x) <> 4
       or not (v_in_match <@ v_ids) then
      raise exception 'The draw is not valid. Randomize it again';
    end if;
    v_rounds := greatest(v_rounds, (v_match ->> 'round')::int);
  end loop;

  -- Every player plays exactly once in each round
  for v_round in 1..v_rounds loop
    if (
      select count(distinct x)
      from jsonb_array_elements(p_matches) as m,
           unnest(array[
             (m -> 'team1' ->> 0)::uuid, (m -> 'team1' ->> 1)::uuid,
             (m -> 'team2' ->> 0)::uuid, (m -> 'team2' ->> 1)::uuid
           ]) as x
      where (m ->> 'round')::int = v_round
    ) <> v_count
    or (
      select count(*) from jsonb_array_elements(p_matches) as m where (m ->> 'round')::int = v_round
    ) <> v_count / 4 then
      raise exception 'The draw is not valid. Randomize it again';
    end if;
  end loop;

  for v_match in select * from jsonb_array_elements(p_matches) loop
    insert into public.tournament_matches (tournament_id, stage, round, side1_players, side2_players)
    values (
      p_tournament_id, 'league', (v_match ->> 'round')::smallint,
      array[(v_match -> 'team1' ->> 0)::uuid, (v_match -> 'team1' ->> 1)::uuid],
      array[(v_match -> 'team2' ->> 0)::uuid, (v_match -> 'team2' ->> 1)::uuid]
    );
  end loop;

  update public.tournaments
  set status = 'live', settings = jsonb_set(settings, '{rounds}', to_jsonb(v_rounds))
  where id = p_tournament_id;

  perform public.log_admin_action(
    'start_tournament', 'tournament', p_tournament_id::text, null,
    jsonb_build_object('format', 'americano', 'mode', 'individual', 'players', v_count, 'rounds', v_rounds),
    null
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Scores from the players: they count right away

-- p_sets / p_super_tiebreak are from side 1, like the admin's score. One set to 4 games sends
-- p_sets [[a, b]]; a super tie-break tournament sends p_super_tiebreak [a, b].
create function public.submit_americano_score(p_match_id uuid, p_sets jsonb, p_super_tiebreak jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_match public.tournament_matches%rowtype;
  v_tournament public.tournaments%rowtype;
  v_a int;
  v_b int;
begin
  select * into v_match from public.tournament_matches where id = p_match_id for update;
  if not found then
    raise exception 'This match no longer exists';
  end if;
  select * into v_tournament from public.tournaments where id = v_match.tournament_id;
  if v_tournament.status <> 'live' or v_match.stage <> 'league' or v_match.side1_players is null then
    raise exception 'Scores can''t be sent for this match';
  end if;
  if public.tournament_match_side(v_match, v_me) is null then
    raise exception 'Only the players in this match can send its score';
  end if;

  if v_tournament.settings ->> 'score_mode' = 'supertiebreak' then
    if p_super_tiebreak is null or jsonb_typeof(p_super_tiebreak) <> 'array' then
      raise exception 'Enter the super tie-break';
    end if;
    v_a := (p_super_tiebreak ->> 0)::int;
    v_b := (p_super_tiebreak ->> 1)::int;
    if not (
      (greatest(v_a, v_b) = 10 and least(v_a, v_b) between 0 and 8)
      or (greatest(v_a, v_b) > 10 and greatest(v_a, v_b) - least(v_a, v_b) = 2)
    ) then
      raise exception 'The super tie-break goes to 10, two points clear';
    end if;
    p_sets := '[]'::jsonb;
  else
    if jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) <> 1 then
      raise exception 'Enter the set';
    end if;
    v_a := (p_sets -> 0 ->> 0)::int;
    v_b := (p_sets -> 0 ->> 1)::int;
    if not (greatest(v_a, v_b) = 4 and least(v_a, v_b) between 0 and 3) then
      raise exception 'The set is won 4-0 to 4-3';
    end if;
    p_super_tiebreak := null;
  end if;

  update public.tournament_matches
  set sets = p_sets,
      super_tiebreak = p_super_tiebreak,
      winner_side = case when v_a > v_b then 1 else 2 end,
      played_at = now(),
      scored_by = v_me
  where id = p_match_id;

  -- The last score ends the tournament, as when the organiser enters it
  if not exists (
    select 1 from public.tournament_matches
    where tournament_id = v_match.tournament_id and stage = 'league' and winner_side is null
  ) then
    update public.tournaments set status = 'finished' where id = v_match.tournament_id;
  end if;
end;
$$;

revoke all on function public.submit_americano_score(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.submit_americano_score(uuid, jsonb, jsonb) to authenticated;
