-- Individual Americano: every player plays alone and the partners change every round. All rounds
-- are drawn when the tournament starts. The ranking adds up what each player's team scored.
--
-- entry_mode 'individual' joins 'pairs' and 'players'. Entries are single players, and a match has
-- four of them: side1_players and side2_players hold two entry ids each. These matches have no
-- entry1_id / entry2_id and record their winner in winner_side (1 or 2).

alter table public.tournament_matches
  add column side1_players uuid[],
  add column side2_players uuid[],
  add column winner_side smallint check (winner_side in (1, 2));

-- ---------------------------------------------------------------------------------------------
-- Create: entry_mode may now be 'individual'

create or replace function public.admin_create_tournament(
  p_name text,
  p_format text,
  p_starts_at timestamptz,
  p_group_count smallint,
  p_club_id text,
  p_category text,
  p_score_mode text,
  p_entry_mode text
)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_id uuid;
  v_club text := nullif(btrim(coalesce(p_club_id, '')), '');
  v_settings jsonb;
begin
  perform public.assert_admin();

  if p_format not in ('groups', 'americano') then
    raise exception 'Choose a tournament format';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Give the tournament a name';
  end if;
  if p_category not in ('men', 'women', 'mixed') then
    raise exception 'Choose men, women or mixed';
  end if;
  if v_club is not null and not exists (select 1 from public.clubs where id = v_club) then
    raise exception 'This club no longer exists';
  end if;

  if p_format = 'groups' then
    if p_group_count not in (2, 4) then
      raise exception 'Use 2 or 4 groups';
    end if;
    v_settings := jsonb_build_object('group_count', p_group_count);
  else
    if p_score_mode not in ('set4', 'supertiebreak') then
      raise exception 'Choose how the score is counted';
    end if;
    if p_entry_mode not in ('pairs', 'players', 'individual') then
      raise exception 'Choose how the players are entered';
    end if;
    v_settings := jsonb_build_object('score_mode', p_score_mode, 'entry_mode', p_entry_mode);
  end if;

  insert into public.tournaments (name, format, starts_at, settings, status, club_id, category)
  values (btrim(p_name), p_format, p_starts_at, v_settings, 'setup', v_club, p_category)
  returning id into v_id;

  perform public.log_admin_action(
    'create_tournament', 'tournament', v_id::text, null,
    jsonb_build_object(
      'name', btrim(p_name), 'format', p_format, 'club_id', v_club, 'category', p_category,
      'settings', v_settings
    ),
    null
  );
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Entries: 'players' and 'individual' tournaments hold single players

create or replace function public.admin_add_tournament_entry(
  p_tournament_id uuid,
  p_name1 text,
  p_name2 text
)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_id uuid;
  v_count int;
  v_next int;
  v_single boolean;
begin
  perform public.assert_admin();
  perform public.assert_tournament_setup(p_tournament_id);

  select coalesce(settings ->> 'entry_mode' in ('players', 'individual'), false) into v_single
  from public.tournaments where id = p_tournament_id;

  if char_length(btrim(coalesce(p_name1, ''))) = 0 then
    raise exception 'Write the player name';
  end if;
  if not v_single and char_length(btrim(coalesce(p_name2, ''))) = 0 then
    raise exception 'Every pair needs two player names';
  end if;

  select count(*), coalesce(max(position) + 1, 0) into v_count, v_next
  from public.tournament_entries where tournament_id = p_tournament_id;
  if v_count >= 32 then
    raise exception 'A tournament can have at most 32 entries';
  end if;

  insert into public.tournament_entries (tournament_id, name1, name2, position)
  values (
    p_tournament_id, btrim(p_name1),
    case when v_single then null else btrim(p_name2) end,
    v_next
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_update_tournament_entry(p_entry_id uuid, p_name1 text, p_name2 text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_tournament uuid;
  v_single boolean;
begin
  perform public.assert_admin();

  select tournament_id into v_tournament from public.tournament_entries where id = p_entry_id;
  if not found then
    raise exception 'This pair no longer exists';
  end if;
  perform public.assert_tournament_setup(v_tournament);

  select coalesce(settings ->> 'entry_mode' in ('players', 'individual'), false) into v_single
  from public.tournaments where id = v_tournament;

  if char_length(btrim(coalesce(p_name1, ''))) = 0 then
    raise exception 'Write the player name';
  end if;
  if not v_single and char_length(btrim(coalesce(p_name2, ''))) = 0 then
    raise exception 'Every pair needs two player names';
  end if;

  update public.tournament_entries
  set name1 = btrim(p_name1), name2 = case when v_single then null else btrim(p_name2) end
  where id = p_entry_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Start: saves the drawn rounds and starts the tournament. The admin app draws them (and shows
-- them first), so what is saved is exactly what the admin saw.
--   p_matches: [{ "round": 1, "team1": ["<entry uuid>", "<entry uuid>"], "team2": [..., ...] }]

create function public.admin_start_individual(p_tournament_id uuid, p_matches jsonb)
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

revoke all on function public.admin_start_individual(uuid, jsonb) from public, anon;
grant execute on function public.admin_start_individual(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Scores: individual matches save winner_side instead of winner_entry_id

create or replace function public.admin_save_tournament_score(
  p_match_id uuid,
  p_sets jsonb,
  p_super_tiebreak jsonb
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_match public.tournament_matches%rowtype;
  v_next public.tournament_matches%rowtype;
  v_mode text;
  v_wins1 int := 0;
  v_wins2 int := 0;
  v_set jsonb;
  v_a int;
  v_b int;
  v_winner uuid;
  v_side smallint;
  v_individual boolean;
  v_before jsonb;
begin
  perform public.assert_admin();

  select * into v_match from public.tournament_matches where id = p_match_id for update;
  if not found then
    raise exception 'This match no longer exists';
  end if;
  v_individual := v_match.side1_players is not null;
  if not v_individual and (v_match.entry1_id is null or v_match.entry2_id is null) then
    raise exception 'This match is waiting for its pairs';
  end if;

  if v_match.stage = 'league' then
    select settings ->> 'score_mode' into v_mode
    from public.tournaments where id = v_match.tournament_id;

    if v_mode = 'set4' then
      if jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) <> 1 then
        raise exception 'Enter the set';
      end if;
      if p_super_tiebreak is not null and jsonb_typeof(p_super_tiebreak) <> 'null' then
        raise exception 'This tournament counts one set, with no super tie-break';
      end if;
      v_a := (p_sets -> 0 ->> 0)::int;
      v_b := (p_sets -> 0 ->> 1)::int;
      if not (greatest(v_a, v_b) = 4 and least(v_a, v_b) between 0 and 3) then
        raise exception 'The set is won 4-0 to 4-3';
      end if;
      p_super_tiebreak := null;
    else
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
    end if;
    v_side := case when v_a > v_b then 1 else 2 end;
    v_winner := case when v_individual then null
                     when v_a > v_b then v_match.entry1_id else v_match.entry2_id end;
  else
    if jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) <> 2 then
      raise exception 'Enter both sets';
    end if;
    for v_set in select * from jsonb_array_elements(p_sets) loop
      v_a := (v_set ->> 0)::int;
      v_b := (v_set ->> 1)::int;
      if not (greatest(v_a, v_b) = 4 and least(v_a, v_b) between 0 and 3) then
        raise exception 'A set is won 4-0 to 4-3';
      end if;
      if v_a > v_b then v_wins1 := v_wins1 + 1; else v_wins2 := v_wins2 + 1; end if;
    end loop;

    if v_wins1 = 1 and v_wins2 = 1 then
      if p_super_tiebreak is null or jsonb_typeof(p_super_tiebreak) <> 'array' then
        raise exception 'One set each: enter the super tie-break';
      end if;
      v_a := (p_super_tiebreak ->> 0)::int;
      v_b := (p_super_tiebreak ->> 1)::int;
      if not (
        (greatest(v_a, v_b) = 10 and least(v_a, v_b) between 0 and 8)
        or (greatest(v_a, v_b) > 10 and greatest(v_a, v_b) - least(v_a, v_b) = 2)
      ) then
        raise exception 'The super tie-break goes to 10, two points clear';
      end if;
      v_winner := case when v_a > v_b then v_match.entry1_id else v_match.entry2_id end;
    else
      if p_super_tiebreak is not null and jsonb_typeof(p_super_tiebreak) <> 'null' then
        raise exception 'There is no super tie-break when one team wins both sets';
      end if;
      p_super_tiebreak := null;
      v_winner := case when v_wins1 = 2 then v_match.entry1_id else v_match.entry2_id end;
    end if;
    v_side := case when v_winner = v_match.entry1_id then 1 else 2 end;
  end if;

  -- Changing the winner of a knockout match is only safe while the next match is unplayed
  if v_match.next_match_id is not null then
    select * into v_next from public.tournament_matches where id = v_match.next_match_id for update;
    if v_next.winner_entry_id is not null then
      raise exception 'The next round has been played already. Clear its score first';
    end if;
    update public.tournament_matches
    set entry1_id = case when v_match.next_slot = 1 then v_winner else entry1_id end,
        entry2_id = case when v_match.next_slot = 2 then v_winner else entry2_id end
    where id = v_match.next_match_id;
  end if;

  v_before := jsonb_build_object('sets', v_match.sets, 'super_tiebreak', v_match.super_tiebreak);

  update public.tournament_matches
  set sets = p_sets, super_tiebreak = p_super_tiebreak, winner_entry_id = v_winner,
      winner_side = case when v_individual then v_side else null end, played_at = now()
  where id = p_match_id;

  if v_match.stage = 'knockout' and v_match.next_match_id is null then
    update public.tournaments set status = 'finished' where id = v_match.tournament_id;
  elsif v_match.stage = 'league' and not exists (
    select 1 from public.tournament_matches
    where tournament_id = v_match.tournament_id and stage = 'league'
      and winner_entry_id is null and winner_side is null
  ) then
    update public.tournaments set status = 'finished' where id = v_match.tournament_id;
  end if;

  perform public.log_admin_action(
    'save_tournament_score', 'tournament', v_match.tournament_id::text, v_before,
    jsonb_build_object('match_id', p_match_id, 'sets', p_sets, 'super_tiebreak', p_super_tiebreak),
    null
  );
end;
$$;
