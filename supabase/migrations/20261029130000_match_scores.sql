-- Match scores. One player from each team must agree on a score before it counts:
-- the host saves it, then a player from the other team confirms it, or corrects it,
-- in which case a player from the host's team has to confirm the correction.
-- A score nobody confirms within 48 hours expires and never counts.
--
-- Teams follow the seats: seats 1-2 are team 1 (the host's), seats 3-4 team 2.
-- Writes go through submit_score and confirm_score only; match_scores has no
-- insert or update policy on purpose.

create table public.match_scores (
  match_id uuid primary key references public.matches (id) on delete cascade,
  -- Games per set, in set order: team1_games[1] vs team2_games[1] is set 1
  team1_games smallint[] not null,
  team2_games smallint[] not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  submitted_by uuid not null references public.profiles (id) on delete cascade,
  submitted_team smallint not null check (submitted_team in (1, 2)),
  submitted_at timestamptz not null default now(),
  -- A pending score past this moment has expired
  expires_at timestamptz not null,
  confirmed_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz
);

alter table public.match_scores enable row level security;

create policy "Signed-in players read scores"
  on public.match_scores for select to authenticated using (true);

-- Best of three sets. A set is won 6-0 to 6-4, 7-5 or 7-6 (tie-break);
-- a third set is only played at one set all.
create function public.is_valid_padel_score(team1 smallint[], team2 smallint[])
  returns boolean
  language plpgsql
  immutable
  set search_path = ''
as $$
declare
  v_sets int := coalesce(array_length(team1, 1), 0);
  v_team1_sets int := 0;
  v_team2_sets int := 0;
  v_high int;
  v_low int;
begin
  if v_sets not in (2, 3) or coalesce(array_length(team2, 1), 0) <> v_sets then
    return false;
  end if;

  for i in 1..v_sets loop
    if team1[i] is null or team2[i] is null then
      return false;
    end if;
    v_high := greatest(team1[i], team2[i]);
    v_low := least(team1[i], team2[i]);
    if not ((v_high = 6 and v_low <= 4) or (v_high = 7 and v_low in (5, 6))) then
      return false;
    end if;
    -- Nothing is played once a team has won two sets
    if v_team1_sets = 2 or v_team2_sets = 2 then
      return false;
    end if;
    if team1[i] > team2[i] then
      v_team1_sets := v_team1_sets + 1;
    else
      v_team2_sets := v_team2_sets + 1;
    end if;
  end loop;

  return v_team1_sets = 2 or v_team2_sets = 2;
end;
$$;

-- Saves a score, or corrects one the other team saved. The host saves first;
-- after that, a player from the team that didn't save it may correct it, and
-- the player who saved it may still edit it until it's confirmed.
create function public.submit_score(p_match_id uuid, p_team1_games smallint[], p_team2_games smallint[])
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_seat smallint;
  v_team smallint;
  v_score public.match_scores%rowtype;
  v_ends_at timestamptz;
  -- How long after the match the host can still add its score
  c_save_window constant interval := interval '7 days';
  -- How long the other team has to confirm
  c_confirm_window constant interval := interval '48 hours';
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'This match no longer exists';
  end if;
  if v_match.status <> 'open' then
    raise exception 'This match was cancelled';
  end if;

  v_ends_at := v_match.starts_at + make_interval(mins => v_match.duration_minutes);
  if now() < v_ends_at then
    raise exception 'You can add the score once the match is over';
  end if;

  -- Every seat must have been taken: the host and their guests, plus everyone who joined
  if (select count(*) from public.match_players where match_id = p_match_id)
     < v_match.players_needed + 1 then
    raise exception 'This match didn''t have 4 players';
  end if;

  select seat into v_seat from public.match_players where match_id = p_match_id and player_id = v_uid;
  if not found then
    raise exception 'Only players in this match can add its score';
  end if;
  v_team := case when v_seat <= 2 then 1 else 2 end;

  if not public.is_valid_padel_score(p_team1_games, p_team2_games) then
    raise exception 'That score isn''t possible. Check each set.';
  end if;

  select * into v_score from public.match_scores where match_id = p_match_id;
  if not found then
    if v_match.host_id <> v_uid then
      raise exception 'The host adds the score first';
    end if;
    if now() > v_ends_at + c_save_window then
      raise exception 'It''s too late to add a score for this match';
    end if;
  else
    if v_score.status = 'confirmed' then
      raise exception 'This score is already confirmed';
    end if;
    if now() > v_score.expires_at then
      raise exception 'This score wasn''t confirmed in time';
    end if;
    if v_team = v_score.submitted_team and v_score.submitted_by <> v_uid then
      raise exception 'Your team already sent this score. A player from the other team confirms it.';
    end if;
  end if;

  insert into public.match_scores (
    match_id, team1_games, team2_games, submitted_by, submitted_team, submitted_at, expires_at
  )
  values (
    p_match_id, p_team1_games, p_team2_games, v_uid, v_team, now(), now() + c_confirm_window
  )
  on conflict (match_id) do update set
    team1_games = excluded.team1_games,
    team2_games = excluded.team2_games,
    submitted_by = excluded.submitted_by,
    submitted_team = excluded.submitted_team,
    submitted_at = excluded.submitted_at,
    expires_at = excluded.expires_at;
end;
$$;

-- Confirms the score the other team saved. Once confirmed it can't change.
create function public.confirm_score(p_match_id uuid)
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
end;
$$;

revoke all on function public.submit_score(uuid, smallint[], smallint[]) from public, anon;
revoke all on function public.confirm_score(uuid) from public, anon;
grant execute on function public.submit_score(uuid, smallint[], smallint[]) to authenticated;
grant execute on function public.confirm_score(uuid) to authenticated;

-- Players see a score arrive or get confirmed without reloading
alter publication supabase_realtime add table public.match_scores;
