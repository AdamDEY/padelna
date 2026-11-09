-- Players join group-stage tournaments from the app, and every new pair is made of app accounts.
--
-- A tournament is open for entries once the admin has set its capacity (admin_set_tournament_registration).
-- Entries that were typed by name before this keep their names and have no player ids; name1 and
-- name2 stay on every entry as a snapshot, so standings and brackets keep reading them.
--
-- Entry status:
--   confirmed        a full pair holding a spot
--   invited          partner has 24 hours to accept; the spot is held meanwhile
--   waitlist_invited the tournament was full; partner has 24 hours to accept
--   waitlist         a full pair waiting. The oldest moves to confirmed when a spot frees up
--   looking          a single player on the partner list; the admin makes the pairs
-- Declined, expired and withdrawn entries are deleted. Expired invites are ignored by reads and
-- removed by the next write on that tournament, so no scheduled job is needed.
--
-- Only 'confirmed' entries go into the draw. Starting the tournament removes all the others.

alter table public.tournaments
  add column capacity smallint check (capacity is null or capacity between 6 and 32),
  add column level_min numeric(2, 1) check (level_min is null or level_min between 1 and 7),
  add column level_max numeric(2, 1) check (level_max is null or level_max between 1 and 7),
  add column registration_closes_at timestamptz,
  add column ends_at timestamptz,
  -- TND per team, paid at the club desk
  add column entry_fee numeric(6, 2) check (entry_fee is null or entry_fee >= 0),
  add column check_in_note text,
  add column prizes text,
  add column prizes_note text,
  add column organiser_name text,
  add column notes text;

alter table public.tournament_entries
  add column player1_id uuid references public.profiles (id) on delete set null,
  add column player2_id uuid references public.profiles (id) on delete set null,
  add column status text not null default 'confirmed'
    check (status in ('confirmed', 'invited', 'waitlist_invited', 'waitlist', 'looking')),
  add column invite_expires_at timestamptz,
  add column created_at timestamptz not null default now();

create index tournament_entries_status_idx on public.tournament_entries (tournament_id, status);
create unique index tournament_entries_player1_idx
  on public.tournament_entries (tournament_id, player1_id) where player1_id is not null;
create unique index tournament_entries_player2_idx
  on public.tournament_entries (tournament_id, player2_id) where player2_id is not null;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'chat_message', 'player_joined', 'match_full', 'player_left', 'court_booked',
    'court_changed', 'court_unbooked', 'match_cancelled', 'score_to_confirm', 'rate_players',
    'match_logged', 'connection_request', 'connection_accepted',
    'tournament_invite', 'tournament_invite_accepted', 'tournament_invite_declined',
    'tournament_partner_left', 'tournament_promoted', 'tournament_added', 'tournament_removed'
  ));

alter table public.notification_outbox drop constraint notification_outbox_kind_check;
alter table public.notification_outbox add constraint notification_outbox_kind_check
  check (kind in (
    'chat_message', 'player_joined', 'match_full', 'player_left', 'court_booked',
    'court_changed', 'court_unbooked', 'match_cancelled', 'score_to_confirm', 'rate_players',
    'match_logged', 'connection_request', 'connection_accepted',
    'tournament_invite', 'tournament_invite_accepted', 'tournament_invite_declined',
    'tournament_partner_left', 'tournament_promoted', 'tournament_added', 'tournament_removed'
  ));

-- ---------------------------------------------------------------------------------------------
-- Internal helpers

-- Spots in use: confirmed pairs plus invites still inside their 24 hours
create function public.tournament_spots_taken(p_tournament_id uuid)
  returns integer
  language sql
  stable
  set search_path = ''
as $$
  select count(*)::integer
  from public.tournament_entries e
  where e.tournament_id = p_tournament_id
    and (e.status = 'confirmed' or (e.status = 'invited' and e.invite_expires_at > now()));
$$;

-- Whether a player can be in a pair of this tournament:
-- 'ok', 'already_in_team', 'wrong_category', 'below_range' or 'above_range'.
-- A single player on the partner list is still free. A level or gender not set yet doesn't block.
create function public.tournament_player_fit(p_tournament_id uuid, p_player_id uuid)
  returns text
  language sql
  stable
  set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.tournament_entries e
      where e.tournament_id = t.id
        and (e.player1_id = p.id or e.player2_id = p.id)
        and e.status <> 'looking'
        and (e.invite_expires_at is null or e.invite_expires_at > now())
    ) then 'already_in_team'
    when (t.category = 'men' and p.gender = 'female')
      or (t.category = 'women' and p.gender = 'male') then 'wrong_category'
    when p.level < t.level_min then 'below_range'
    when p.level > t.level_max then 'above_range'
    else 'ok'
  end
  from public.tournaments t
  cross join public.profiles p
  where t.id = p_tournament_id and p.id = p_player_id;
$$;

-- What the app and the dashboard show about a player in a pair
create function public.tournament_player_json(p_player_id uuid)
  returns jsonb
  language sql
  stable
  set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'level', p.level,
    'avatar_url', p.avatar_url,
    'coach_verified', exists (select 1 from public.coach_evaluations ce where ce.player_id = p.id),
    'is_friend', public.connection_status(auth.uid(), p.id) = 'connected'
  )
  from public.profiles p
  where p.id = p_player_id;
$$;

create function public.tournament_notify(
  p_player_id uuid,
  p_kind text,
  p_tournament_id uuid,
  p_actor_id uuid default null
)
  returns void
  language plpgsql
  set search_path = ''
as $$
begin
  if p_player_id is null then
    return;
  end if;
  perform public.queue_push(
    p_player_id,
    p_kind,
    jsonb_build_object(
      'name', (select first_name from public.profiles where id = p_actor_id),
      'tournament', (select name from public.tournaments where id = p_tournament_id)
    ),
    '/tournament/' || p_tournament_id,
    null,
    p_actor_id
  );
end;
$$;

-- Drops invites past their 24 hours, then moves waiting pairs into free spots, oldest first.
-- Every write on entries ends with this. The caller holds the lock on the tournament row.
create function public.tournament_refresh(p_tournament_id uuid)
  returns void
  language plpgsql
  set search_path = ''
as $$
declare
  v_capacity integer;
  v_entry public.tournament_entries%rowtype;
begin
  delete from public.tournament_entries
  where tournament_id = p_tournament_id
    and status in ('invited', 'waitlist_invited')
    and invite_expires_at <= now();

  select capacity into v_capacity from public.tournaments where id = p_tournament_id;
  if v_capacity is null then
    return;
  end if;

  while public.tournament_spots_taken(p_tournament_id) < v_capacity loop
    select * into v_entry
    from public.tournament_entries
    where tournament_id = p_tournament_id and status = 'waitlist'
    order by created_at
    limit 1;
    exit when not found;

    update public.tournament_entries set status = 'confirmed' where id = v_entry.id;
    perform public.tournament_notify(v_entry.player1_id, 'tournament_promoted', p_tournament_id);
    perform public.tournament_notify(v_entry.player2_id, 'tournament_promoted', p_tournament_id);
  end loop;
end;
$$;

-- Locks the tournament and checks a player may still register. Returns the row.
create function public.tournament_lock_for_registration(p_tournament_id uuid)
  returns public.tournaments
  language plpgsql
  set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  if not found then
    raise exception 'This tournament no longer exists';
  end if;
  if v_tournament.format <> 'groups'
    or v_tournament.status <> 'setup'
    or v_tournament.capacity is null
    or v_tournament.registration_closes_at <= now()
    or v_tournament.starts_at <= now() then
    raise exception 'Registration for this tournament is closed';
  end if;
  return v_tournament;
end;
$$;

create function public.tournament_next_position(p_tournament_id uuid)
  returns smallint
  language sql
  stable
  set search_path = ''
as $$
  select coalesce(max(position) + 1, 0)::smallint
  from public.tournament_entries where tournament_id = p_tournament_id;
$$;

create function public.tournament_player_name(p_player_id uuid)
  returns text
  language sql
  stable
  set search_path = ''
as $$
  select btrim(first_name || ' ' || last_name) from public.profiles where id = p_player_id;
$$;

revoke all on function public.tournament_spots_taken(uuid) from public, anon, authenticated;
revoke all on function public.tournament_player_fit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.tournament_player_json(uuid) from public, anon, authenticated;
revoke all on function public.tournament_notify(uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.tournament_refresh(uuid) from public, anon, authenticated;
revoke all on function public.tournament_lock_for_registration(uuid) from public, anon, authenticated;
revoke all on function public.tournament_next_position(uuid) from public, anon, authenticated;
revoke all on function public.tournament_player_name(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Player reads

-- Home and the Tournaments list: every tournament still open for entries, soonest first.
-- Americano shows too, but only group-stage tournaments can be joined so far (registration_open).
create function public.get_tournaments(p_limit integer default 50)
  returns table (
    id uuid, name text, format text, category text, entry_mode text, starts_at timestamptz,
    club_name text, capacity integer, entries_count integer, spots_left integer,
    waitlist_count integer, registration_open boolean, my_status text
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select
    t.id, t.name, t.format, t.category, t.settings ->> 'entry_mode', t.starts_at, c.name,
    t.capacity::integer,
    public.tournament_spots_taken(t.id),
    case when t.capacity is null then null
         else greatest(t.capacity - public.tournament_spots_taken(t.id), 0) end,
    (select count(*)::integer from public.tournament_entries e
      where e.tournament_id = t.id and e.status in ('waitlist', 'waitlist_invited')
        and (e.invite_expires_at is null or e.invite_expires_at > now())),
    t.format = 'groups' and t.capacity is not null
      and (t.registration_closes_at is null or t.registration_closes_at > now())
      and (t.starts_at is null or t.starts_at > now()),
    (select e.status from public.tournament_entries e
      where e.tournament_id = t.id
        and (e.player1_id = auth.uid() or e.player2_id = auth.uid())
        and (e.invite_expires_at is null or e.invite_expires_at > now())
      limit 1)
  from public.tournaments t
  left join public.clubs c on c.id = t.club_id
  where auth.uid() is not null
    and t.status = 'setup'
    and (t.starts_at is null or t.starts_at > now() - interval '1 day')
  order by t.starts_at nulls last, t.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- The Tournament detail screen. Null if the tournament doesn't exist.
create function public.get_tournament(p_id uuid)
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

  select * into v_mine from public.tournament_entries e
  where e.tournament_id = p_id
    and (e.player1_id = v_me or e.player2_id = v_me)
    and (e.invite_expires_at is null or e.invite_expires_at > now())
  limit 1;
  v_partner := case when v_mine.player1_id = v_me then v_mine.player2_id else v_mine.player1_id end;

  return jsonb_build_object(
    'tournament', to_jsonb(v_tournament) || jsonb_build_object(
      'club_name', (select name from public.clubs where id = v_tournament.club_id),
      'club_city', (select city from public.clubs where id = v_tournament.club_id)
    ),
    'registration_open',
      v_tournament.format = 'groups' and v_tournament.status = 'setup' and v_tournament.capacity is not null
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

-- "Who is your partner?": my friends, the ones who can play first, then whoever we played with most.
-- fit: ok, already_in_team, wrong_category, below_range, above_range
create function public.get_tournament_partner_candidates(p_tournament_id uuid, p_query text default null)
  returns table (
    id uuid, first_name text, last_name text, level numeric, avatar_url text,
    matches_together integer, fit text
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with friends as (
    select case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end as friend_id
    from public.connections c
    where c.status = 'accepted' and auth.uid() in (c.requester_id, c.addressee_id)
  ),
  q as (
    select '%' || replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select
    p.id, p.first_name, p.last_name, p.level, p.avatar_url,
    (select count(*)::integer
     from public.played_matches() mine
     join public.played_matches() theirs on theirs.match_id = mine.match_id
     where mine.player_id = auth.uid() and theirs.player_id = p.id),
    public.tournament_player_fit(p_tournament_id, p.id)
  from friends f
  join public.profiles p on p.id = f.friend_id
  cross join q
  where p.first_name || ' ' || p.last_name ilike q.pattern
  order by
    public.tournament_player_fit(p_tournament_id, p.id) = 'ok' desc,
    6 desc,
    p.first_name, p.last_name
  limit 100;
$$;

-- ---------------------------------------------------------------------------------------------
-- Player writes

-- Invites a friend. The spot is held for 24 hours; if the tournament is full the pair goes on the
-- waitlist once the partner accepts. Returns the new entry's status.
create function public.join_tournament(p_tournament_id uuid, p_partner_id uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_tournament public.tournaments%rowtype;
  v_status text;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Not signed in';
  end if;

  v_tournament := public.tournament_lock_for_registration(p_tournament_id);
  perform public.tournament_refresh(p_tournament_id);

  case public.tournament_player_fit(p_tournament_id, v_me)
    when 'ok' then null;
    when 'already_in_team' then raise exception 'You are already in this tournament';
    when 'wrong_category' then raise exception 'This tournament is for another category';
    else raise exception 'Your level is outside this tournament''s range';
  end case;

  if p_partner_id is null or p_partner_id = v_me then
    raise exception 'Choose a partner';
  end if;
  if public.connection_status(v_me, p_partner_id) <> 'connected' then
    raise exception 'You can only invite a friend';
  end if;
  case public.tournament_player_fit(p_tournament_id, p_partner_id)
    when 'ok' then null;
    when 'already_in_team' then raise exception 'Your partner is already in a team';
    when 'wrong_category' then raise exception 'Your partner can''t play in this category';
    else raise exception 'Your partner is outside this tournament''s level range';
  end case;

  delete from public.tournament_entries
  where tournament_id = p_tournament_id and player1_id = v_me and status = 'looking';

  v_status := case when public.tournament_spots_taken(p_tournament_id) < v_tournament.capacity
                   then 'invited' else 'waitlist_invited' end;

  insert into public.tournament_entries (
    tournament_id, name1, name2, position, player1_id, player2_id, status, invite_expires_at
  )
  values (
    p_tournament_id,
    public.tournament_player_name(v_me),
    public.tournament_player_name(p_partner_id),
    public.tournament_next_position(p_tournament_id),
    v_me, p_partner_id, v_status, now() + interval '24 hours'
  )
  returning id into v_id;

  perform public.tournament_notify(p_partner_id, 'tournament_invite', p_tournament_id, v_me);
  return jsonb_build_object('entry_id', v_id, 'status', v_status);
end;
$$;

-- "No partner yet?": puts me on the partner list; the admin makes the pairs. Works when full too.
create function public.join_tournament_partner_list(p_tournament_id uuid)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Not signed in';
  end if;

  perform public.tournament_lock_for_registration(p_tournament_id);
  perform public.tournament_refresh(p_tournament_id);

  case public.tournament_player_fit(p_tournament_id, v_me)
    when 'ok' then null;
    when 'already_in_team' then raise exception 'You are already in this tournament';
    when 'wrong_category' then raise exception 'This tournament is for another category';
    else raise exception 'Your level is outside this tournament''s range';
  end case;
  if exists (
    select 1 from public.tournament_entries
    where tournament_id = p_tournament_id and player1_id = v_me and status = 'looking'
  ) then
    raise exception 'You are already in this tournament';
  end if;

  insert into public.tournament_entries (tournament_id, name1, position, player1_id, status)
  values (
    p_tournament_id, public.tournament_player_name(v_me),
    public.tournament_next_position(p_tournament_id), v_me, 'looking'
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- The invited partner accepts or declines. Returns the entry's new status, or null when declined.
create function public.respond_to_tournament_invite(p_entry_id uuid, p_accept boolean)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_tournament uuid;
  v_entry public.tournament_entries%rowtype;
  v_status text;
begin
  select tournament_id into v_tournament from public.tournament_entries where id = p_entry_id;
  if not found then
    raise exception 'This invitation is no longer valid';
  end if;
  perform 1 from public.tournaments where id = v_tournament for update;
  perform public.assert_tournament_setup(v_tournament);

  select * into v_entry from public.tournament_entries where id = p_entry_id;
  if v_entry.player2_id is distinct from v_me
    or v_entry.status not in ('invited', 'waitlist_invited')
    or v_entry.invite_expires_at <= now() then
    raise exception 'This invitation is no longer valid';
  end if;

  if not p_accept then
    delete from public.tournament_entries where id = p_entry_id;
    perform public.tournament_notify(v_entry.player1_id, 'tournament_invite_declined', v_tournament, v_me);
    perform public.tournament_refresh(v_tournament);
    return null;
  end if;

  delete from public.tournament_entries
  where tournament_id = v_tournament and player1_id = v_me and status = 'looking';

  v_status := case when v_entry.status = 'invited' then 'confirmed' else 'waitlist' end;
  update public.tournament_entries
  set status = v_status, invite_expires_at = null
  where id = p_entry_id;

  perform public.tournament_notify(v_entry.player1_id, 'tournament_invite_accepted', v_tournament, v_me);
  perform public.tournament_refresh(v_tournament);
  return (select status from public.tournament_entries where id = p_entry_id);
end;
$$;

-- Leaves before the start: the whole pair drops out, and the next pair on the waitlist moves up.
create function public.leave_tournament(p_tournament_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_entry public.tournament_entries%rowtype;
  v_partner uuid;
begin
  perform 1 from public.tournaments where id = p_tournament_id for update;
  perform public.assert_tournament_setup(p_tournament_id);

  select * into v_entry from public.tournament_entries
  where tournament_id = p_tournament_id and (player1_id = v_me or player2_id = v_me)
  limit 1;
  if not found then
    raise exception 'You are not in this tournament';
  end if;

  delete from public.tournament_entries where id = v_entry.id;

  v_partner := case when v_entry.player1_id = v_me then v_entry.player2_id else v_entry.player1_id end;
  perform public.tournament_notify(v_partner, 'tournament_partner_left', p_tournament_id, v_me);
  perform public.tournament_refresh(p_tournament_id);
end;
$$;

revoke all on function public.get_tournaments(integer) from public, anon;
revoke all on function public.get_tournament(uuid) from public, anon;
revoke all on function public.get_tournament_partner_candidates(uuid, text) from public, anon;
revoke all on function public.join_tournament(uuid, uuid) from public, anon;
revoke all on function public.join_tournament_partner_list(uuid) from public, anon;
revoke all on function public.respond_to_tournament_invite(uuid, boolean) from public, anon;
revoke all on function public.leave_tournament(uuid) from public, anon;
grant execute on function public.get_tournaments(integer) to authenticated;
grant execute on function public.get_tournament(uuid) to authenticated;
grant execute on function public.get_tournament_partner_candidates(uuid, text) to authenticated;
grant execute on function public.join_tournament(uuid, uuid) to authenticated;
grant execute on function public.join_tournament_partner_list(uuid) to authenticated;
grant execute on function public.respond_to_tournament_invite(uuid, boolean) to authenticated;
grant execute on function public.leave_tournament(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Admin

-- Name autocomplete when adding a pair: results from the first letter typed.
create function public.admin_search_tournament_players(p_tournament_id uuid, p_query text)
  returns table (
    id uuid, first_name text, last_name text, level numeric, avatar_url text, gender text,
    city text, fit text, entry_status text
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_pattern text;
begin
  perform public.assert_admin();

  if char_length(btrim(coalesce(p_query, ''))) = 0 then
    return;
  end if;
  v_pattern := '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select
    p.id, p.first_name, p.last_name, p.level, p.avatar_url, p.gender, p.city,
    public.tournament_player_fit(p_tournament_id, p.id),
    (select e.status from public.tournament_entries e
      where e.tournament_id = p_tournament_id and (e.player1_id = p.id or e.player2_id = p.id)
        and (e.invite_expires_at is null or e.invite_expires_at > now())
      limit 1)
  from public.profiles p
  where p.first_name || ' ' || p.last_name ilike v_pattern
  order by public.tournament_player_fit(p_tournament_id, p.id) = 'already_in_team', p.first_name, p.last_name
  limit 10;
end;
$$;

-- Adds a pair of app players, confirmed straight away. The admin can go outside the level range or
-- category (the dashboard warns), but not over capacity. Takes players off the partner list.
create function public.admin_add_tournament_pair(p_tournament_id uuid, p_player1 uuid, p_player2 uuid)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_capacity integer;
  v_id uuid;
begin
  perform public.assert_admin();
  perform public.assert_tournament_setup(p_tournament_id);

  select capacity into v_capacity from public.tournaments where id = p_tournament_id for update;
  perform public.tournament_refresh(p_tournament_id);

  if p_player1 is null or p_player2 is null then
    raise exception 'Every pair needs two players';
  end if;
  if p_player1 = p_player2 then
    raise exception 'Choose two different players';
  end if;
  if not exists (select 1 from public.profiles where id = p_player1)
    or not exists (select 1 from public.profiles where id = p_player2) then
    raise exception 'This player no longer exists';
  end if;
  if public.tournament_player_fit(p_tournament_id, p_player1) = 'already_in_team'
    or public.tournament_player_fit(p_tournament_id, p_player2) = 'already_in_team' then
    raise exception 'One of these players is already in a team';
  end if;
  if public.tournament_spots_taken(p_tournament_id) >= coalesce(v_capacity, 32) then
    raise exception 'This tournament is full';
  end if;

  delete from public.tournament_entries
  where tournament_id = p_tournament_id and status = 'looking'
    and player1_id in (p_player1, p_player2);

  insert into public.tournament_entries (tournament_id, name1, name2, position, player1_id, player2_id, status)
  values (
    p_tournament_id,
    public.tournament_player_name(p_player1),
    public.tournament_player_name(p_player2),
    public.tournament_next_position(p_tournament_id),
    p_player1, p_player2, 'confirmed'
  )
  returning id into v_id;

  perform public.tournament_notify(p_player1, 'tournament_added', p_tournament_id);
  perform public.tournament_notify(p_player2, 'tournament_added', p_tournament_id);
  perform public.log_admin_action(
    'add_tournament_pair', 'tournament', p_tournament_id::text, null,
    jsonb_build_object('entry_id', v_id, 'player1', p_player1, 'player2', p_player2), null
  );
  return v_id;
end;
$$;

-- Swaps the players of an existing pair (or links a typed pair to app players).
create function public.admin_update_tournament_pair(p_entry_id uuid, p_player1 uuid, p_player2 uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_entry public.tournament_entries%rowtype;
  v_taken uuid;
begin
  perform public.assert_admin();

  select * into v_entry from public.tournament_entries where id = p_entry_id;
  if not found then
    raise exception 'This pair no longer exists';
  end if;
  perform public.assert_tournament_setup(v_entry.tournament_id);
  perform 1 from public.tournaments where id = v_entry.tournament_id for update;
  perform public.tournament_refresh(v_entry.tournament_id);

  if p_player1 is null or p_player2 is null then
    raise exception 'Every pair needs two players';
  end if;
  if p_player1 = p_player2 then
    raise exception 'Choose two different players';
  end if;
  if not exists (select 1 from public.profiles where id = p_player1)
    or not exists (select 1 from public.profiles where id = p_player2) then
    raise exception 'This player no longer exists';
  end if;

  select e.id into v_taken from public.tournament_entries e
  where e.tournament_id = v_entry.tournament_id and e.id <> p_entry_id and e.status <> 'looking'
    and (e.player1_id in (p_player1, p_player2) or e.player2_id in (p_player1, p_player2))
    and (e.invite_expires_at is null or e.invite_expires_at > now())
  limit 1;
  if found then
    raise exception 'One of these players is already in a team';
  end if;

  delete from public.tournament_entries
  where tournament_id = v_entry.tournament_id and id <> p_entry_id and status = 'looking'
    and player1_id in (p_player1, p_player2);

  update public.tournament_entries
  set player1_id = p_player1,
      player2_id = p_player2,
      name1 = public.tournament_player_name(p_player1),
      name2 = public.tournament_player_name(p_player2)
  where id = p_entry_id;

  if p_player1 not in (coalesce(v_entry.player1_id, p_player2), coalesce(v_entry.player2_id, p_player2)) then
    perform public.tournament_notify(p_player1, 'tournament_added', v_entry.tournament_id);
  end if;
  if p_player2 not in (coalesce(v_entry.player1_id, p_player1), coalesce(v_entry.player2_id, p_player1)) then
    perform public.tournament_notify(p_player2, 'tournament_added', v_entry.tournament_id);
  end if;
  perform public.log_admin_action(
    'update_tournament_pair', 'tournament', v_entry.tournament_id::text,
    jsonb_build_object('entry_id', p_entry_id, 'player1', v_entry.player1_id, 'player2', v_entry.player2_id),
    jsonb_build_object('player1', p_player1, 'player2', p_player2), null
  );
end;
$$;

-- Everything the app's detail screen shows that the admin sets. A tournament can't be joined until
-- it has a capacity.
create function public.admin_set_tournament_registration(
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

-- Removing a pair frees its spot, so the next pair on the waitlist moves up
create or replace function public.admin_remove_tournament_entry(p_entry_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_entry public.tournament_entries%rowtype;
begin
  perform public.assert_admin();

  select * into v_entry from public.tournament_entries where id = p_entry_id;
  if not found then
    raise exception 'This pair no longer exists';
  end if;
  perform public.assert_tournament_setup(v_entry.tournament_id);
  perform 1 from public.tournaments where id = v_entry.tournament_id for update;

  delete from public.tournament_entries where id = p_entry_id;

  perform public.tournament_notify(v_entry.player1_id, 'tournament_removed', v_entry.tournament_id);
  perform public.tournament_notify(v_entry.player2_id, 'tournament_removed', v_entry.tournament_id);
  perform public.tournament_refresh(v_entry.tournament_id);
end;
$$;

-- Only confirmed pairs go into the draw
create or replace function public.admin_save_tournament_draw(
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
    where id = (v_item ->> 'id')::uuid and tournament_id = p_tournament_id and status = 'confirmed';
  end loop;
end;
$$;

-- Starts with the confirmed pairs. Invites, the waitlist and the partner list end here.
create or replace function public.admin_start_tournament(p_tournament_id uuid, p_matches jsonb)
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
    where tournament_id = p_tournament_id and status = 'confirmed' and group_label is null
  ) then
    raise exception 'Randomize the groups first: some pairs have no group';
  end if;
  if (select count(*) from public.tournament_entries
      where tournament_id = p_tournament_id and status = 'confirmed') < v_group_count * 3 then
    raise exception 'Every group needs at least 3 pairs';
  end if;
  if exists (
    select 1
    from generate_series(1, v_group_count) as n
    where (
      select count(*) from public.tournament_entries
      where tournament_id = p_tournament_id and status = 'confirmed' and group_label = chr(64 + n)
    ) < 3
  ) then
    raise exception 'Every group needs at least 3 pairs';
  end if;

  delete from public.tournament_entries
  where tournament_id = p_tournament_id and status <> 'confirmed';

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

-- 'entries' counts confirmed pairs only, so the dashboard's list matches the draw
create or replace function public.admin_list_tournaments()
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
        tn.id, tn.name, tn.format, tn.status, tn.starts_at, tn.created_at,
        tn.category, tn.club_id, c.name as club_name, tn.capacity,
        (select count(*) from public.tournament_entries e
          where e.tournament_id = tn.id and e.status = 'confirmed') as entries,
        (select count(*) from public.tournament_matches m where m.tournament_id = tn.id) as matches_total,
        (select count(*) from public.tournament_matches m
          where m.tournament_id = tn.id and m.winner_entry_id is not null) as matches_done
      from public.tournaments tn
      left join public.clubs c on c.id = tn.club_id
    ) t
  ), '[]'::jsonb);
end;
$$;

-- Entries of every status, each with its players. The dashboard filters by status.
create or replace function public.admin_get_tournament(p_id uuid)
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
    'tournament',
      to_jsonb(v_tournament)
      || jsonb_build_object('club_name', (select name from public.clubs where id = v_tournament.club_id)),
    'entries', coalesce((
      select jsonb_agg(
        to_jsonb(e) || jsonb_build_object(
          'player1', public.tournament_player_json(e.player1_id),
          'player2', public.tournament_player_json(e.player2_id)
        )
        order by e.group_label, e.position
      )
      from public.tournament_entries e
      where e.tournament_id = p_id
        and (e.invite_expires_at is null or e.invite_expires_at > now())
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.stage desc, m.round, m.group_label, m.label)
      from public.tournament_matches m where m.tournament_id = p_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_search_tournament_players(uuid, text) from public, anon;
revoke all on function public.admin_add_tournament_pair(uuid, uuid, uuid) from public, anon;
revoke all on function public.admin_update_tournament_pair(uuid, uuid, uuid) from public, anon;
revoke all on function public.admin_set_tournament_registration(uuid, smallint, numeric, numeric, timestamptz, timestamptz, numeric, text, text, text, text, text) from public, anon;
grant execute on function public.admin_search_tournament_players(uuid, text) to authenticated;
grant execute on function public.admin_add_tournament_pair(uuid, uuid, uuid) to authenticated;
grant execute on function public.admin_update_tournament_pair(uuid, uuid, uuid) to authenticated;
grant execute on function public.admin_set_tournament_registration(uuid, smallint, numeric, numeric, timestamptz, timestamptz, numeric, text, text, text, text, text) to authenticated;
