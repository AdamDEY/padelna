-- Americano tournaments (basic version): fixed pairs, every pair plays every other pair once,
-- and the ranking table decides the winner. No groups and no knockout.
--
-- settings for an americano tournament:
--   score_mode: 'set4' (one set to 4 games, 4-0 to 4-3) or 'supertiebreak' (to 10, two clear)
--   entry_mode: 'pairs' (the admin types ready pairs) or 'players' (the admin types single
--               players and the draw forms the pairs)
--
-- Every entry has a pair_no, the number of its team. In 'pairs' mode each entry is its own team
-- and pair_no is its place in the draw. In 'players' mode two players share a pair_no; starting
-- the tournament turns each team into one pair entry.

alter table public.tournament_entries add column pair_no smallint;

alter table public.tournament_matches drop constraint tournament_matches_stage_check;
alter table public.tournament_matches
  add constraint tournament_matches_stage_check check (stage in ('group', 'knockout', 'league'));

-- ---------------------------------------------------------------------------------------------
-- Create: takes the format and the americano options

drop function public.admin_create_tournament(text, text, timestamptz, smallint, text, text);

create function public.admin_create_tournament(
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
    if p_entry_mode not in ('pairs', 'players') then
      raise exception 'Choose whether you enter pairs or players';
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

revoke all on function public.admin_create_tournament(text, text, timestamptz, smallint, text, text, text, text)
  from public, anon;
grant execute on function public.admin_create_tournament(text, text, timestamptz, smallint, text, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Entries: in 'players' mode an entry is one player, so the second name stays empty

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

  select settings ->> 'entry_mode' = 'players' into v_single
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

  select settings ->> 'entry_mode' = 'players' into v_single
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
-- Draw: the team number of each entry
--   p_assignments: [{ "id": "<entry uuid>", "pair": 1 }]
-- Pairs mode: the place of each pair in the draw. Players mode: the pair each player joins.

create function public.admin_save_pair_draw(p_tournament_id uuid, p_assignments jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_item jsonb;
begin
  perform public.assert_admin();
  perform public.assert_tournament_setup(p_tournament_id);

  if (select format from public.tournaments where id = p_tournament_id) <> 'americano' then
    raise exception 'This tournament has groups, not pairs to draw';
  end if;

  update public.tournament_entries set pair_no = null where tournament_id = p_tournament_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) loop
    update public.tournament_entries
    set pair_no = (v_item ->> 'pair')::smallint
    where id = (v_item ->> 'id')::uuid and tournament_id = p_tournament_id;
  end loop;
end;
$$;

-- Locks the draw and starts the tournament. The matches name teams by their position in the
-- draw (0 is team 1).
--   p_matches: [{ "round": 1, "entry1": 0, "entry2": 3 }]
create function public.admin_start_americano(p_tournament_id uuid, p_matches jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_settings jsonb;
  v_single boolean;
  v_ids uuid[] := '{}';
  v_old uuid[];
  v_team smallint;
  v_names text[];
  v_new uuid;
  v_index int := 0;
  v_match jsonb;
begin
  perform public.assert_admin();
  perform public.assert_tournament_setup(p_tournament_id);

  select settings into v_settings
  from public.tournaments where id = p_tournament_id and format = 'americano' for update;
  if not found then
    raise exception 'This is not an Americano tournament';
  end if;
  v_single := v_settings ->> 'entry_mode' = 'players';

  if exists (
    select 1 from public.tournament_entries
    where tournament_id = p_tournament_id and pair_no is null
  ) then
    raise exception 'Randomize the draw first';
  end if;

  if v_single then
    if (select count(*) from public.tournament_entries where tournament_id = p_tournament_id) < 6 then
      raise exception 'You need at least 6 players (3 pairs)';
    end if;
    if exists (
      select 1 from public.tournament_entries where tournament_id = p_tournament_id
      group by pair_no having count(*) <> 2
    ) then
      raise exception 'Every pair needs exactly 2 players';
    end if;

    v_old := array(select id from public.tournament_entries where tournament_id = p_tournament_id);
    for v_team in
      select distinct pair_no from public.tournament_entries
      where tournament_id = p_tournament_id order by pair_no
    loop
      select array_agg(name1 order by position, id) into v_names
      from public.tournament_entries
      where tournament_id = p_tournament_id and id = any (v_old) and pair_no = v_team;

      insert into public.tournament_entries (tournament_id, name1, name2, position, pair_no)
      values (p_tournament_id, v_names[1], v_names[2], v_index, v_team)
      returning id into v_new;
      v_ids := v_ids || v_new;
      v_index := v_index + 1;
    end loop;
    delete from public.tournament_entries where id = any (v_old);
  else
    if (select count(*) from public.tournament_entries where tournament_id = p_tournament_id) < 3 then
      raise exception 'You need at least 3 pairs';
    end if;
    if exists (
      select 1 from public.tournament_entries where tournament_id = p_tournament_id
      group by pair_no having count(*) > 1
    ) then
      raise exception 'Randomize the draw again';
    end if;
    v_ids := array(
      select id from public.tournament_entries
      where tournament_id = p_tournament_id order by pair_no, id
    );
  end if;

  for v_match in select * from jsonb_array_elements(p_matches) loop
    insert into public.tournament_matches (tournament_id, stage, round, entry1_id, entry2_id)
    values (
      p_tournament_id, 'league', (v_match ->> 'round')::smallint,
      v_ids[(v_match ->> 'entry1')::int + 1], v_ids[(v_match ->> 'entry2')::int + 1]
    );
  end loop;

  update public.tournaments set status = 'live' where id = p_tournament_id;

  perform public.log_admin_action(
    'start_tournament', 'tournament', p_tournament_id::text, null,
    jsonb_build_object('format', 'americano', 'pairs', array_length(v_ids, 1), 'matches', jsonb_array_length(p_matches)),
    null
  );
end;
$$;

revoke all on function public.admin_save_pair_draw(uuid, jsonb) from public, anon;
revoke all on function public.admin_start_americano(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_pair_draw(uuid, jsonb) to authenticated;
grant execute on function public.admin_start_americano(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Scores: league (americano) matches use one set to 4 games, or a super tie-break, as the
-- tournament says. Group and knockout matches keep the two sets plus super tie-break rule.

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
  v_before jsonb;
begin
  perform public.assert_admin();

  select * into v_match from public.tournament_matches where id = p_match_id for update;
  if not found then
    raise exception 'This match no longer exists';
  end if;
  if v_match.entry1_id is null or v_match.entry2_id is null then
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
      v_winner := case when v_a > v_b then v_match.entry1_id else v_match.entry2_id end;
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
      v_winner := case when v_a > v_b then v_match.entry1_id else v_match.entry2_id end;
    end if;
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
  set sets = p_sets, super_tiebreak = p_super_tiebreak, winner_entry_id = v_winner, played_at = now()
  where id = p_match_id;

  -- The final decides a group tournament; the last match decides an americano
  if v_match.stage = 'knockout' and v_match.next_match_id is null then
    update public.tournaments set status = 'finished' where id = v_match.tournament_id;
  elsif v_match.stage = 'league' and not exists (
    select 1 from public.tournament_matches
    where tournament_id = v_match.tournament_id and stage = 'league' and winner_entry_id is null
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
