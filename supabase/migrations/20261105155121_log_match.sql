-- Logging a match played outside the app. A logged match is an ordinary finished match
-- (matches + match_players + match_scores), so the score follows the same trust rules as one
-- played through the app: the player who logs it is the host on team 1, a player from the
-- other team confirms the score or enters the real one (submit_score / confirm_score), and a
-- score nobody confirms within 48 hours expires. Only confirmed results reach the feeds, and
-- only competitive ones change levels (settle_match_levels).
--
-- log_match writes everything in one go as a security-definer function: the insert policy
-- only allows future matches, and check_match_edit / check_match_court only look at writes
-- made directly by players.

alter table public.matches
  add column origin text not null default 'app' check (origin in ('app', 'logged'));

-- Opponents tagged in a logged match hear about it with its own notification
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'chat_message', 'player_joined', 'match_full', 'player_left', 'court_booked',
    'court_changed', 'court_unbooked', 'match_cancelled', 'score_to_confirm', 'rate_players',
    'match_logged', 'connection_request', 'connection_accepted'
  ));

alter table public.notification_outbox drop constraint notification_outbox_kind_check;
alter table public.notification_outbox add constraint notification_outbox_kind_check
  check (kind in (
    'chat_message', 'player_joined', 'match_full', 'player_left', 'court_booked',
    'court_changed', 'court_unbooked', 'match_cancelled', 'score_to_confirm', 'rate_players',
    'match_logged', 'connection_request', 'connection_accepted'
  ));

create or replace function public.queue_push(
  p_player_id uuid,
  p_kind text,
  p_params jsonb,
  p_url text,
  p_match_id uuid default null,
  p_actor_id uuid default null
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_settings public.notification_settings%rowtype;
  v_wants boolean;
begin
  -- The in-app list gets everything, whatever the push settings say
  if p_kind <> 'chat_message' then
    insert into public.notifications (player_id, kind, actor_id, match_id, params, url)
    values (p_player_id, p_kind, p_actor_id, p_match_id, p_params, p_url);
  end if;

  select * into v_settings from public.notification_settings where player_id = p_player_id;
  v_wants := case
    when not found then true
    when p_kind = 'chat_message' then v_settings.chat
    when p_kind in (
      'player_joined', 'match_full', 'player_left', 'court_booked', 'court_changed',
      'court_unbooked', 'match_cancelled'
    ) then v_settings.match_updates
    when p_kind in ('score_to_confirm', 'rate_players', 'match_logged') then v_settings.scores
    when p_kind in ('connection_request', 'connection_accepted') then v_settings.connections
    else true
  end;
  if not v_wants or not exists (select 1 from public.push_tokens where player_id = p_player_id) then
    return;
  end if;

  insert into public.notification_outbox (player_id, kind, params, url, match_id)
  values (p_player_id, p_kind, p_params, p_url, p_match_id);
end;
$$;

-- Logs a finished match: you (seat 1) and your partner (seat 2) against two opponents
-- (seats 3-4), with the score you saw. Returns the new match's id.
create function public.log_match(
  p_court_id uuid,
  p_starts_at timestamptz,
  p_kind text,
  p_partner_id uuid,
  p_opponent_ids uuid[],
  p_team1_games smallint[],
  p_team2_games smallint[]
)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_players uuid[];
  v_match_id uuid;
  v_level_min numeric;
  v_level_max numeric;
  -- Same as submit_score: how long after a match its score can be added, and confirmed
  c_save_window constant interval := interval '7 days';
  c_confirm_window constant interval := interval '48 hours';
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;

  v_players := array[v_uid, p_partner_id] || coalesce(p_opponent_ids, '{}');
  if array_length(v_players, 1) <> 4 or array_position(v_players, null) is not null
     or (select count(distinct id) from unnest(v_players) as id) <> 4 then
    raise exception 'Tag 3 different players';
  end if;
  if (select count(*) from public.profiles where id = any (v_players)) <> 4 then
    raise exception 'This player no longer exists';
  end if;

  if not exists (
    select 1 from public.courts ct
    join public.clubs c on c.id = ct.club_id
    where ct.id = p_court_id and c.status = 'published'
  ) then
    raise exception 'Pick a club and court from the list';
  end if;

  if p_starts_at + interval '90 minutes' > now() then
    raise exception 'You can log a match once it''s over';
  end if;
  if p_starts_at + interval '90 minutes' + c_save_window < now() then
    raise exception 'You can only log matches from the last 7 days';
  end if;

  if not public.is_valid_padel_score(p_team1_games, p_team2_games) then
    raise exception 'That score isn''t possible. Check each set.';
  end if;

  -- The same overlap rule as hosting (the exclusion constraint on matches), in words
  if exists (
    select 1 from public.matches m
    where m.host_id = v_uid and m.status = 'open'
      and m.starts_at < p_starts_at + interval '90 minutes'
      and p_starts_at < m.starts_at + make_interval(mins => m.duration_minutes)
  ) then
    raise exception 'You already have a match at that time';
  end if;

  -- The match is for the levels of the people who played it
  select coalesce(min(level), 1), coalesce(max(level), 7)
  into v_level_min, v_level_max
  from public.profiles where id = any (v_players);

  insert into public.matches (
    host_id, court_id, starts_at, level_min, level_max, kind, players_needed, origin
  )
  values (v_uid, p_court_id, p_starts_at, v_level_min, v_level_max, p_kind, 3, 'logged')
  returning id into v_match_id;

  -- Seat 1 (you) comes from the matches_add_host trigger
  insert into public.match_players (match_id, seat, player_id)
  values
    (v_match_id, 2, p_partner_id),
    (v_match_id, 3, p_opponent_ids[1]),
    (v_match_id, 4, p_opponent_ids[2]);

  -- Sent by your team, so a player from the other team confirms it (push_match_score tells them)
  insert into public.match_scores (
    match_id, team1_games, team2_games, submitted_by, submitted_team, submitted_at, expires_at
  )
  values (v_match_id, p_team1_games, p_team2_games, v_uid, 1, now(), now() + c_confirm_window);

  return v_match_id;
end;
$$;

revoke all on function public.log_match(uuid, timestamptz, text, uuid, uuid[], smallint[], smallint[])
  from public, anon;
grant execute on function public.log_match(uuid, timestamptz, text, uuid, uuid[], smallint[], smallint[])
  to authenticated;

-- A logged match's opponents first hear of it through its score, so they get "X logged a
-- match with you" instead of "X added the score"
create or replace function public.push_match_score()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_params jsonb;
  v_player record;
begin
  if tg_op = 'UPDATE' and new.submitted_at is not distinct from old.submitted_at then
    return null;
  end if;
  select * into v_match from public.matches where id = new.match_id;
  v_params := jsonb_build_object(
    'name', coalesce((select first_name from public.profiles where id = new.submitted_by), ''),
    'when', public.push_match_time(v_match.starts_at)
  );

  for v_player in
    select player_id, case when seat <= 2 then 1 else 2 end as team
    from public.match_players
    where match_id = new.match_id and player_id <> new.submitted_by
  loop
    if v_player.team <> new.submitted_team then
      perform public.queue_push(v_player.player_id,
        case when tg_op = 'INSERT' and v_match.origin = 'logged' then 'match_logged'
             else 'score_to_confirm' end,
        v_params, '/match/' || new.match_id, new.match_id, new.submitted_by);
    elsif tg_op = 'INSERT' then
      perform public.queue_push(v_player.player_id, 'rate_players', v_params,
        '/match/' || new.match_id || '/rate', new.match_id, new.submitted_by);
    end if;
  end loop;
  return null;
end;
$$;

-- Tagged players didn't "join" a logged match, so it gets no join notes in its chat (and
-- no "joined your match" pushes from them)
create or replace function public.note_match_player_change()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_row public.match_players%rowtype;
  v_kind text;
begin
  if tg_op = 'INSERT' then
    v_row := new;
  else
    v_row := old;
  end if;

  select * into v_match from public.matches where id = v_row.match_id;
  if not found or v_row.player_id = v_match.host_id or v_match.origin = 'logged' then
    return null;
  end if;
  if not exists (select 1 from public.profiles where id = v_row.player_id) then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_kind := case
      when (select count(*) from public.match_players where match_id = v_row.match_id)
           >= v_match.players_needed + 1 then 'joined_full'
      else 'joined'
    end;
  else
    v_kind := 'left';
  end if;

  insert into public.match_messages (match_id, sender_id, kind)
  values (v_row.match_id, v_row.player_id, v_kind);
  return null;
end;
$$;

-- A logged match only counts as played (your clubs, people you played with) once the other
-- team has confirmed it; otherwise anyone could write themselves a history
create or replace function public.played_matches()
  returns table (match_id uuid, player_id uuid, club_id text, club_name text, played_at timestamptz)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select m.id, mp.player_id, c.id, c.name, m.starts_at
  from public.matches m
  join public.match_players mp on mp.match_id = m.id
  left join public.courts ct on ct.id = m.court_id
  left join public.clubs c on c.id = ct.club_id
  where m.status = 'open'
    and m.starts_at + make_interval(mins => m.duration_minutes) <= now()
    and (select count(*) from public.match_players full_seats where full_seats.match_id = m.id)
        = m.players_needed + 1
    and (
      m.origin = 'app'
      or exists (
        select 1 from public.match_scores s where s.match_id = m.id and s.status = 'confirmed'
      )
    );
$$;
