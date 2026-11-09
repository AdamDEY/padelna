-- Players follow a group + knockout tournament once it is live, and send match scores.
--
-- A player in a match sends the score (two sets to 4, then a super tie-break at one set each, the
-- same rules as admin_save_tournament_score). It waits on the match as a submission and doesn't
-- count until the organiser confirms it in the dashboard, which saves it as the real score, or
-- rejects it. A player can send it again while it waits, which replaces it.
--
-- get_tournaments now also lists live tournaments, and get_tournament_live returns everything the
-- live screens need: entries with their players, matches, and submissions. Standings are worked
-- out in the app from the confirmed scores, the same way the dashboard does.

alter table public.tournament_matches
  add column submitted_sets jsonb,
  add column submitted_super_tiebreak jsonb,
  add column submitted_by uuid references public.profiles (id) on delete set null,
  add column submitted_at timestamptz;

-- Which side of a match a player is on: 1, 2, or null when they're not playing it
create function public.tournament_match_side(p_match public.tournament_matches, p_player_id uuid)
  returns smallint
  language sql
  stable
  set search_path = ''
as $$
  select case
    when exists (select 1 from public.tournament_entries e
                 where e.id = p_match.entry1_id and p_player_id in (e.player1_id, e.player2_id)) then 1
    when exists (select 1 from public.tournament_entries e
                 where e.id = p_match.entry2_id and p_player_id in (e.player1_id, e.player2_id)) then 2
  end::smallint;
$$;

revoke all on function public.tournament_match_side(public.tournament_matches, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Player reads

drop function public.get_tournaments(integer);

-- Live tournaments come first and stay listed until they finish
create function public.get_tournaments(p_limit integer default 50)
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
    t.status = 'setup' and t.format = 'groups' and t.capacity is not null
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

revoke all on function public.get_tournaments(integer) from public, anon;
grant execute on function public.get_tournaments(integer) to authenticated;

-- A live or finished tournament as the player sees it. Null before it starts or if it's gone.
create function public.get_tournament_live(p_id uuid)
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
          'submitted_sets', case when m.winner_entry_id is null then m.submitted_sets end,
          'submitted_super_tiebreak', case when m.winner_entry_id is null then m.submitted_super_tiebreak end,
          'submitted_by_me', m.winner_entry_id is null and m.submitted_by = v_me,
          'my_side', public.tournament_match_side(m, v_me)
        )
        order by m.stage desc, m.round, m.group_label, m.label
      )
      from public.tournament_matches m
      where m.tournament_id = p_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_tournament_live(uuid) from public, anon;
grant execute on function public.get_tournament_live(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Player write

-- p_sets and p_super_tiebreak are written from side 1 of the match (entry1 first), like the
-- admin's score. The app turns the player's own view around before sending.
create function public.submit_tournament_score(p_match_id uuid, p_sets jsonb, p_super_tiebreak jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_match public.tournament_matches%rowtype;
  v_status text;
  v_set jsonb;
  v_a int;
  v_b int;
  v_wins1 int := 0;
  v_wins2 int := 0;
begin
  select * into v_match from public.tournament_matches where id = p_match_id for update;
  if not found then
    raise exception 'This match no longer exists';
  end if;
  select status into v_status from public.tournaments where id = v_match.tournament_id;
  if v_status <> 'live' or v_match.stage not in ('group', 'knockout') then
    raise exception 'Scores can''t be sent for this match';
  end if;
  if public.tournament_match_side(v_match, v_me) is null then
    raise exception 'Only the players in this match can send its score';
  end if;
  if v_match.entry1_id is null or v_match.entry2_id is null then
    raise exception 'This match is waiting for its pairs';
  end if;
  if v_match.winner_entry_id is not null then
    raise exception 'The organiser has already confirmed this score';
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
  else
    p_super_tiebreak := null;
  end if;

  update public.tournament_matches
  set submitted_sets = p_sets,
      submitted_super_tiebreak = p_super_tiebreak,
      submitted_by = v_me,
      submitted_at = now()
  where id = p_match_id;
end;
$$;

revoke all on function public.submit_tournament_score(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.submit_tournament_score(uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Admin

-- Saves the players' score as the real one (checked and logged by admin_save_tournament_score)
create function public.admin_confirm_tournament_score(p_match_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_match public.tournament_matches%rowtype;
begin
  perform public.assert_admin();

  select * into v_match from public.tournament_matches where id = p_match_id;
  if not found then
    raise exception 'This match no longer exists';
  end if;
  if v_match.submitted_sets is null then
    raise exception 'No score is waiting for this match';
  end if;

  perform public.admin_save_tournament_score(p_match_id, v_match.submitted_sets, v_match.submitted_super_tiebreak);

  update public.tournament_matches
  set submitted_sets = null, submitted_super_tiebreak = null, submitted_by = null, submitted_at = null
  where id = p_match_id;
end;
$$;

create function public.admin_reject_tournament_score(p_match_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_match public.tournament_matches%rowtype;
begin
  perform public.assert_admin();

  select * into v_match from public.tournament_matches where id = p_match_id for update;
  if not found then
    raise exception 'This match no longer exists';
  end if;

  update public.tournament_matches
  set submitted_sets = null, submitted_super_tiebreak = null, submitted_by = null, submitted_at = null
  where id = p_match_id;

  perform public.log_admin_action(
    'reject_tournament_score', 'tournament', v_match.tournament_id::text,
    jsonb_build_object('match_id', p_match_id, 'sets', v_match.submitted_sets,
                       'super_tiebreak', v_match.submitted_super_tiebreak, 'by', v_match.submitted_by),
    null, null
  );
end;
$$;

-- A score the admin types in directly replaces whatever the players sent
create function public.tournament_clear_submission()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.winner_entry_id is not null and old.winner_entry_id is distinct from new.winner_entry_id
     or new.sets is distinct from old.sets then
    new.submitted_sets := null;
    new.submitted_super_tiebreak := null;
    new.submitted_by := null;
    new.submitted_at := null;
  end if;
  return new;
end;
$$;

create trigger tournament_matches_clear_submission
  before update of winner_entry_id, sets on public.tournament_matches
  for each row execute function public.tournament_clear_submission();

revoke all on function public.admin_confirm_tournament_score(uuid) from public, anon;
revoke all on function public.admin_reject_tournament_score(uuid) from public, anon;
grant execute on function public.admin_confirm_tournament_score(uuid) to authenticated;
grant execute on function public.admin_reject_tournament_score(uuid) to authenticated;
