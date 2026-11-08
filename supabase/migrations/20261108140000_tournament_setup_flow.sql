-- Tournaments now start in a 'setup' stage: the admin creates the tournament, adds the pairs
-- over the following days, then on the day randomizes the groups and starts it. Starting
-- creates the group matches and moves the tournament to 'live'.

alter table public.tournaments drop constraint tournaments_status_check;
alter table public.tournaments
  add constraint tournaments_status_check check (status in ('setup', 'live', 'finished'));
alter table public.tournaments alter column status set default 'setup';

-- The first version created everything at once; replaced by the steps below
drop function public.admin_create_tournament(text, text, date, jsonb, jsonb, jsonb);

create function public.admin_create_tournament(
  p_name text,
  p_format text,
  p_starts_on date,
  p_group_count smallint
)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.assert_admin();

  if p_format <> 'groups' then
    raise exception 'Only group-stage tournaments can be created for now';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Give the tournament a name';
  end if;
  if p_group_count not in (2, 4) then
    raise exception 'Use 2 or 4 groups';
  end if;

  insert into public.tournaments (name, format, starts_on, settings, status)
  values (btrim(p_name), p_format, p_starts_on, jsonb_build_object('group_count', p_group_count), 'setup')
  returning id into v_id;

  perform public.log_admin_action(
    'create_tournament', 'tournament', v_id::text, null,
    jsonb_build_object('name', btrim(p_name), 'format', p_format), null
  );
  return v_id;
end;
$$;

-- Used by every setup step below: the tournament must exist and still be in setup
create function public.assert_tournament_setup(p_tournament_id uuid)
  returns void
  language plpgsql
  stable
  set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.tournaments where id = p_tournament_id;
  if not found then
    raise exception 'This tournament no longer exists';
  end if;
  if v_status <> 'setup' then
    raise exception 'The tournament has started, so its pairs and groups are locked';
  end if;
end;
$$;

revoke all on function public.assert_tournament_setup(uuid) from public, anon, authenticated;

create function public.admin_add_tournament_entry(
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
begin
  perform public.assert_admin();
  perform public.assert_tournament_setup(p_tournament_id);

  if char_length(btrim(coalesce(p_name1, ''))) = 0 or char_length(btrim(coalesce(p_name2, ''))) = 0 then
    raise exception 'Every pair needs two player names';
  end if;

  select count(*) into v_count from public.tournament_entries where tournament_id = p_tournament_id;
  if v_count >= 32 then
    raise exception 'A tournament can have at most 32 pairs';
  end if;

  insert into public.tournament_entries (tournament_id, name1, name2, position)
  values (p_tournament_id, btrim(p_name1), btrim(p_name2), v_count)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.admin_update_tournament_entry(p_entry_id uuid, p_name1 text, p_name2 text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_tournament uuid;
begin
  perform public.assert_admin();

  select tournament_id into v_tournament from public.tournament_entries where id = p_entry_id;
  if not found then
    raise exception 'This pair no longer exists';
  end if;
  perform public.assert_tournament_setup(v_tournament);

  if char_length(btrim(coalesce(p_name1, ''))) = 0 or char_length(btrim(coalesce(p_name2, ''))) = 0 then
    raise exception 'Every pair needs two player names';
  end if;

  update public.tournament_entries
  set name1 = btrim(p_name1), name2 = btrim(p_name2)
  where id = p_entry_id;
end;
$$;

create function public.admin_remove_tournament_entry(p_entry_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_tournament uuid;
begin
  perform public.assert_admin();

  select tournament_id into v_tournament from public.tournament_entries where id = p_entry_id;
  if not found then
    raise exception 'This pair no longer exists';
  end if;
  perform public.assert_tournament_setup(v_tournament);

  delete from public.tournament_entries where id = p_entry_id;
end;
$$;

-- Saves the draw: the number of groups and the group of each pair. Pairs left out of
-- p_assignments have no group yet. The admin app makes the random draw and sends the result,
-- so a move by hand and a re-draw are saved the same way.
--   p_assignments: [{ "id": "<entry uuid>", "group": "A" }]
create function public.admin_save_tournament_draw(
  p_tournament_id uuid,
  p_group_count smallint,
  p_assignments jsonb
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_item jsonb;
  v_labels text[];
begin
  perform public.assert_admin();
  perform public.assert_tournament_setup(p_tournament_id);

  if p_group_count not in (2, 4) then
    raise exception 'Use 2 or 4 groups';
  end if;
  v_labels := array(select chr(64 + n) from generate_series(1, p_group_count) as n);

  update public.tournaments
  set settings = jsonb_set(settings, '{group_count}', to_jsonb(p_group_count))
  where id = p_tournament_id;

  update public.tournament_entries set group_label = null where tournament_id = p_tournament_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) loop
    if not ((v_item ->> 'group') = any (v_labels)) then
      raise exception 'Unknown group';
    end if;
    update public.tournament_entries
    set group_label = v_item ->> 'group'
    where id = (v_item ->> 'id')::uuid and tournament_id = p_tournament_id;
  end loop;
end;
$$;

-- Locks the draw, creates the group matches and starts the tournament.
--   p_matches: [{ "group": "A", "round": 1, "entry1": "<entry uuid>", "entry2": "<entry uuid>" }]
create function public.admin_start_tournament(p_tournament_id uuid, p_matches jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_match jsonb;
  v_group_count int;
begin
  perform public.assert_admin();
  perform public.assert_tournament_setup(p_tournament_id);

  select (settings ->> 'group_count')::int into v_group_count
  from public.tournaments where id = p_tournament_id for update;

  if exists (
    select 1 from public.tournament_entries
    where tournament_id = p_tournament_id and group_label is null
  ) then
    raise exception 'Randomize the groups first: some pairs have no group';
  end if;
  if (select count(*) from public.tournament_entries where tournament_id = p_tournament_id)
     < v_group_count * 3 then
    raise exception 'Every group needs at least 3 pairs';
  end if;
  if exists (
    select 1
    from generate_series(1, v_group_count) as n
    where (
      select count(*) from public.tournament_entries
      where tournament_id = p_tournament_id and group_label = chr(64 + n)
    ) < 3
  ) then
    raise exception 'Every group needs at least 3 pairs';
  end if;

  for v_match in select * from jsonb_array_elements(p_matches) loop
    insert into public.tournament_matches (tournament_id, stage, group_label, round, entry1_id, entry2_id)
    values (
      p_tournament_id, 'group', v_match ->> 'group', (v_match ->> 'round')::smallint,
      (v_match ->> 'entry1')::uuid, (v_match ->> 'entry2')::uuid
    );
  end loop;

  update public.tournaments set status = 'live' where id = p_tournament_id;

  perform public.log_admin_action(
    'start_tournament', 'tournament', p_tournament_id::text, null,
    jsonb_build_object('matches', jsonb_array_length(p_matches)), null
  );
end;
$$;

revoke all on function public.admin_create_tournament(text, text, date, smallint) from public, anon;
revoke all on function public.admin_add_tournament_entry(uuid, text, text) from public, anon;
revoke all on function public.admin_update_tournament_entry(uuid, text, text) from public, anon;
revoke all on function public.admin_remove_tournament_entry(uuid) from public, anon;
revoke all on function public.admin_save_tournament_draw(uuid, smallint, jsonb) from public, anon;
revoke all on function public.admin_start_tournament(uuid, jsonb) from public, anon;
grant execute on function public.admin_create_tournament(text, text, date, smallint) to authenticated;
grant execute on function public.admin_add_tournament_entry(uuid, text, text) to authenticated;
grant execute on function public.admin_update_tournament_entry(uuid, text, text) to authenticated;
grant execute on function public.admin_remove_tournament_entry(uuid) to authenticated;
grant execute on function public.admin_save_tournament_draw(uuid, smallint, jsonb) to authenticated;
grant execute on function public.admin_start_tournament(uuid, jsonb) to authenticated;
