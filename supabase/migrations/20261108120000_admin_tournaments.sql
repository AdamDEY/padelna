-- Tournaments, run by the admin only (MVP). Two formats are planned: 'groups' (pairs in groups,
-- then a knockout) is built first, 'americano' comes next.
--
-- Entries are typed names, not player accounts, so tournaments work for people who aren't in the
-- app. Results never change player levels. Scores are entered by the admin.
--
-- Group-stage match format: two sets to 4 games (4-0 to 4-3), and a super tie-break (to 10,
-- two clear) when the teams win a set each. The same rules live in the admin app's
-- tournament-engine.ts; admin_save_tournament_score checks them again here.
--
-- Everything goes through admin_* functions. The tables have no policies for players at all.

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  format text not null check (format in ('groups', 'americano')),
  status text not null default 'live' check (status in ('live', 'finished')),
  starts_on date,
  -- groups: { "group_count": 4 }
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- A pair (groups) or a single player (americano, name2 empty)
create table public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name1 text not null check (char_length(btrim(name1)) > 0),
  name2 text check (name2 is null or char_length(btrim(name2)) > 0),
  group_label text check (group_label is null or group_label ~ '^[A-H]$'),
  position smallint not null
);

create index tournament_entries_tournament_idx on public.tournament_entries (tournament_id);

create table public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  stage text not null check (stage in ('group', 'knockout')),
  group_label text check (group_label is null or group_label ~ '^[A-H]$'),
  -- Round inside the group, or the knockout round (1 = first)
  round smallint not null,
  label text,
  entry1_id uuid references public.tournament_entries (id) on delete cascade,
  entry2_id uuid references public.tournament_entries (id) on delete cascade,
  -- [[4,2],[1,4]]: games per set, team 1 first
  sets jsonb,
  -- [10,8], only when the sets were one each
  super_tiebreak jsonb,
  winner_entry_id uuid references public.tournament_entries (id),
  -- Knockout bracket: the winner moves into this match, on this side
  next_match_id uuid references public.tournament_matches (id),
  next_slot smallint check (next_slot in (1, 2)),
  played_at timestamptz
);

create index tournament_matches_tournament_idx on public.tournament_matches (tournament_id);

alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.tournament_matches enable row level security;

revoke all on public.tournaments, public.tournament_entries, public.tournament_matches
  from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Reads

create function public.admin_list_tournaments()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  perform public.assert_admin();

  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.created_at desc)
    from (
      select
        tn.id, tn.name, tn.format, tn.status, tn.starts_on, tn.created_at,
        (select count(*) from public.tournament_entries e where e.tournament_id = tn.id) as entries,
        (select count(*) from public.tournament_matches m where m.tournament_id = tn.id) as matches_total,
        (select count(*) from public.tournament_matches m
          where m.tournament_id = tn.id and m.winner_entry_id is not null) as matches_done
      from public.tournaments tn
    ) t
  ), '[]'::jsonb);
end;
$$;

create function public.admin_get_tournament(p_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
begin
  perform public.assert_admin();

  select * into v_tournament from public.tournaments where id = p_id;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'tournament', to_jsonb(v_tournament),
    'entries', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.group_label, e.position)
      from public.tournament_entries e where e.tournament_id = p_id
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.stage desc, m.round, m.group_label, m.label)
      from public.tournament_matches m where m.tournament_id = p_id
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Writes

-- Creates a tournament with its draw in one go. The admin app makes the random draw and shows it
-- first, so what is saved is exactly what the admin saw (and edited).
--   p_entries: [{ "name1": "...", "name2": "...", "group": "A" }]
--   p_matches: [{ "group": "A", "round": 1, "entry1": 0, "entry2": 3 }]  (entry numbers are
--              positions in p_entries)
create function public.admin_create_tournament(
  p_name text,
  p_format text,
  p_starts_on date,
  p_settings jsonb,
  p_entries jsonb,
  p_matches jsonb
)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_id uuid;
  v_entry jsonb;
  v_match jsonb;
  v_ids uuid[] := '{}';
  v_new_id uuid;
  v_index int := 0;
begin
  perform public.assert_admin();

  if p_format <> 'groups' then
    raise exception 'Only group-stage tournaments can be created for now';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Give the tournament a name';
  end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) < 6 then
    raise exception 'A group stage needs at least 6 pairs';
  end if;
  if jsonb_array_length(p_entries) > 32 then
    raise exception 'A tournament can have at most 32 pairs';
  end if;

  insert into public.tournaments (name, format, starts_on, settings)
  values (btrim(p_name), p_format, p_starts_on, coalesce(p_settings, '{}'))
  returning id into v_id;

  for v_entry in select * from jsonb_array_elements(p_entries) loop
    insert into public.tournament_entries (tournament_id, name1, name2, group_label, position)
    values (
      v_id,
      btrim(v_entry ->> 'name1'),
      nullif(btrim(coalesce(v_entry ->> 'name2', '')), ''),
      v_entry ->> 'group',
      v_index
    )
    returning id into v_new_id;
    v_ids := v_ids || v_new_id;
    v_index := v_index + 1;
  end loop;

  for v_match in select * from jsonb_array_elements(p_matches) loop
    insert into public.tournament_matches (tournament_id, stage, group_label, round, entry1_id, entry2_id)
    values (
      v_id, 'group', v_match ->> 'group', (v_match ->> 'round')::smallint,
      v_ids[(v_match ->> 'entry1')::int + 1],
      v_ids[(v_match ->> 'entry2')::int + 1]
    );
  end loop;

  perform public.log_admin_action(
    'create_tournament', 'tournament', v_id::text, null,
    jsonb_build_object('name', btrim(p_name), 'format', p_format, 'pairs', jsonb_array_length(p_entries)),
    null
  );
  return v_id;
end;
$$;

-- Sets or corrects a match score and moves the winner on in the knockout. A score can't be
-- changed once the match the winner moved into has been played.
create function public.admin_save_tournament_score(
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

  -- The final decides the tournament
  if v_match.stage = 'knockout' and v_match.next_match_id is null then
    update public.tournaments set status = 'finished' where id = v_match.tournament_id;
  end if;

  perform public.log_admin_action(
    'save_tournament_score', 'tournament', v_match.tournament_id::text, v_before,
    jsonb_build_object('match_id', p_match_id, 'sets', p_sets, 'super_tiebreak', p_super_tiebreak),
    null
  );
end;
$$;

-- Adds the knockout bracket once the group stage is over. The admin app builds the bracket from
-- the standings (and shows it first); the admin can swap qualifiers there.
--   p_matches: [{ "key": "QF1", "round": 1, "label": "Quarter-final 1",
--                 "entry1": "<entry uuid>"|null, "entry2": ..., "next_key": "SF1"|null, "next_slot": 1 }]
create function public.admin_create_knockout(p_tournament_id uuid, p_matches jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_match jsonb;
  v_ids jsonb := '{}';
  v_new_id uuid;
begin
  perform public.assert_admin();

  if not exists (select 1 from public.tournaments where id = p_tournament_id) then
    raise exception 'This tournament no longer exists';
  end if;
  if exists (
    select 1 from public.tournament_matches
    where tournament_id = p_tournament_id and stage = 'knockout'
  ) then
    raise exception 'The knockout stage already exists';
  end if;
  if exists (
    select 1 from public.tournament_matches
    where tournament_id = p_tournament_id and stage = 'group' and winner_entry_id is null
  ) then
    raise exception 'Finish the group stage first';
  end if;

  for v_match in select * from jsonb_array_elements(p_matches) loop
    insert into public.tournament_matches
      (tournament_id, stage, round, label, entry1_id, entry2_id, next_slot)
    values (
      p_tournament_id, 'knockout', (v_match ->> 'round')::smallint, v_match ->> 'label',
      nullif(v_match ->> 'entry1', '')::uuid, nullif(v_match ->> 'entry2', '')::uuid,
      nullif(v_match ->> 'next_slot', '')::smallint
    )
    returning id into v_new_id;
    v_ids := v_ids || jsonb_build_object(v_match ->> 'key', v_new_id);
  end loop;

  for v_match in select * from jsonb_array_elements(p_matches) loop
    if nullif(v_match ->> 'next_key', '') is not null then
      update public.tournament_matches
      set next_match_id = (v_ids ->> (v_match ->> 'next_key'))::uuid
      where id = (v_ids ->> (v_match ->> 'key'))::uuid;
    end if;
  end loop;

  perform public.log_admin_action(
    'create_knockout', 'tournament', p_tournament_id::text, null,
    jsonb_build_object('matches', jsonb_array_length(p_matches)), null
  );
end;
$$;

create function public.admin_delete_tournament(p_id uuid, p_reason text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
begin
  perform public.assert_admin();

  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Write a reason of at least 3 characters';
  end if;

  select * into v_tournament from public.tournaments where id = p_id for update;
  if not found then
    raise exception 'This tournament no longer exists';
  end if;

  delete from public.tournaments where id = p_id;

  perform public.log_admin_action(
    'delete_tournament', 'tournament', p_id::text,
    jsonb_build_object('name', v_tournament.name, 'format', v_tournament.format),
    null, btrim(p_reason)
  );
end;
$$;

revoke all on function public.admin_list_tournaments() from public, anon;
revoke all on function public.admin_get_tournament(uuid) from public, anon;
revoke all on function public.admin_create_tournament(text, text, date, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.admin_save_tournament_score(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.admin_create_knockout(uuid, jsonb) from public, anon;
revoke all on function public.admin_delete_tournament(uuid, text) from public, anon;
grant execute on function public.admin_list_tournaments() to authenticated;
grant execute on function public.admin_get_tournament(uuid) to authenticated;
grant execute on function public.admin_create_tournament(text, text, date, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.admin_save_tournament_score(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.admin_create_knockout(uuid, jsonb) to authenticated;
grant execute on function public.admin_delete_tournament(uuid, text) to authenticated;
