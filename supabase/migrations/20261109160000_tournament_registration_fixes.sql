-- Fixes from testing the tournament join flow:
--
-- 1. A player on the partner list who gets invited has two entries. An invite now always wins over
--    the partner-list entry when working out "my entry", so they can answer it.
-- 2. Capacity has to leave at least 3 pairs per group, or the tournament could never start.
-- 3. Invites past their 24 hours are handled every minute, not on the next write: the captain is
--    told and the oldest waiting pair moves into the free spot.
-- 4. Withdrawing an unanswered invite says so, instead of "your team is out".

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'chat_message', 'player_joined', 'match_full', 'player_left', 'court_booked',
    'court_changed', 'court_unbooked', 'match_cancelled', 'score_to_confirm', 'rate_players',
    'match_logged', 'connection_request', 'connection_accepted',
    'tournament_invite', 'tournament_invite_accepted', 'tournament_invite_declined',
    'tournament_invite_cancelled', 'tournament_invite_expired',
    'tournament_partner_left', 'tournament_promoted', 'tournament_added', 'tournament_removed'
  ));

alter table public.notification_outbox drop constraint notification_outbox_kind_check;
alter table public.notification_outbox add constraint notification_outbox_kind_check
  check (kind in (
    'chat_message', 'player_joined', 'match_full', 'player_left', 'court_booked',
    'court_changed', 'court_unbooked', 'match_cancelled', 'score_to_confirm', 'rate_players',
    'match_logged', 'connection_request', 'connection_accepted',
    'tournament_invite', 'tournament_invite_accepted', 'tournament_invite_declined',
    'tournament_invite_cancelled', 'tournament_invite_expired',
    'tournament_partner_left', 'tournament_promoted', 'tournament_added', 'tournament_removed'
  ));

-- ---------------------------------------------------------------------------------------------
-- 1. Which entry is "mine"

-- A player has one entry, or a partner-list entry plus an invite from a friend. The invite wins,
-- because it is the one waiting for an answer. Expired invites don't count.
create function public.tournament_entry_of(p_tournament_id uuid, p_player_id uuid)
  returns public.tournament_entries
  language sql
  stable
  set search_path = ''
as $$
  select e.*
  from public.tournament_entries e
  where e.tournament_id = p_tournament_id
    and (e.player1_id = p_player_id or e.player2_id = p_player_id)
    and (e.invite_expires_at is null or e.invite_expires_at > now())
  order by e.status = 'looking', e.created_at
  limit 1;
$$;

revoke all on function public.tournament_entry_of(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_tournaments(p_limit integer default 50)
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
    (public.tournament_entry_of(t.id, auth.uid())).status
  from public.tournaments t
  left join public.clubs c on c.id = t.club_id
  where auth.uid() is not null
    and t.status = 'setup'
    and (t.starts_at is null or t.starts_at > now() - interval '1 day')
  order by t.starts_at nulls last, t.created_at desc
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

-- The partner-list entry goes first: an invite waiting on top of it is answered, not left. Otherwise
-- the message depends on what is being withdrawn (4).
create or replace function public.leave_tournament(p_tournament_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_entry public.tournament_entries%rowtype;
  v_partner uuid;
  v_is_invite boolean;
begin
  perform 1 from public.tournaments where id = p_tournament_id for update;
  perform public.assert_tournament_setup(p_tournament_id);
  perform public.tournament_refresh(p_tournament_id);

  select * into v_entry from public.tournament_entries
  where tournament_id = p_tournament_id and (player1_id = v_me or player2_id = v_me)
  order by status = 'looking' desc, created_at
  limit 1;
  if not found then
    raise exception 'You are not in this tournament';
  end if;

  delete from public.tournament_entries where id = v_entry.id;

  v_is_invite := v_entry.status in ('invited', 'waitlist_invited');
  v_partner := case when v_entry.player1_id = v_me then v_entry.player2_id else v_entry.player1_id end;
  perform public.tournament_notify(
    v_partner,
    case
      when v_is_invite and v_entry.player1_id = v_me then 'tournament_invite_cancelled'
      when v_is_invite then 'tournament_invite_declined'
      else 'tournament_partner_left'
    end,
    p_tournament_id,
    v_me
  );
  perform public.tournament_refresh(p_tournament_id);
end;
$$;

create or replace function public.admin_search_tournament_players(p_tournament_id uuid, p_query text)
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
    (public.tournament_entry_of(p_tournament_id, p.id)).status
  from public.profiles p
  where p.first_name || ' ' || p.last_name ilike v_pattern
  order by public.tournament_player_fit(p_tournament_id, p.id) = 'already_in_team', p.first_name, p.last_name
  limit 10;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Capacity against the number of groups

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

-- The draw can change the number of groups, so it checks the same rule
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
  if (select capacity from public.tournaments where id = p_tournament_id) < p_group_count * 3 then
    raise exception 'Every group needs at least 3 pairs, so raise the capacity or use fewer groups';
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

-- ---------------------------------------------------------------------------------------------
-- 3. Invites past their 24 hours

create or replace function public.tournament_refresh(p_tournament_id uuid)
  returns void
  language plpgsql
  set search_path = ''
as $$
declare
  v_capacity integer;
  v_entry public.tournament_entries%rowtype;
  v_expired record;
begin
  for v_expired in
    delete from public.tournament_entries
    where tournament_id = p_tournament_id
      and status in ('invited', 'waitlist_invited')
      and invite_expires_at <= now()
    returning player1_id, player2_id
  loop
    perform public.tournament_notify(
      v_expired.player1_id, 'tournament_invite_expired', p_tournament_id, v_expired.player2_id
    );
  end loop;

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

create function public.expire_tournament_invites()
  returns void
  language plpgsql
  set search_path = ''
as $$
declare
  v_tournament uuid;
begin
  for v_tournament in
    select distinct tournament_id from public.tournament_entries
    where status in ('invited', 'waitlist_invited') and invite_expires_at <= now()
  loop
    perform 1 from public.tournaments where id = v_tournament for update;
    perform public.tournament_refresh(v_tournament);
  end loop;
end;
$$;

revoke all on function public.expire_tournament_invites() from public, anon, authenticated;

select cron.schedule('expire-tournament-invites', '* * * * *', $$select public.expire_tournament_invites()$$);
