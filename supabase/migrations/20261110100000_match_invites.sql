-- Match invitations: the host adds a player to an open seat after creating the match, and that
-- player accepts or declines. Nobody has to wait for someone to find the match and join.
--
-- An invitation holds its seat while it waits, so nobody else can join that seat. It ends when
-- the player answers, when the host takes it back, or when the match is cancelled. Accepting
-- takes the seat exactly like join_match (so the host hears "X joined"); declining or being
-- taken back sends a note to the other side. The invited player's "You're invited" notification
-- disappears once it can't be answered any more, so the list never keeps asking.
--
-- The host decides who to invite, so the level range doesn't apply (it does when players join
-- on their own). A men or women match still only takes that gender, and nobody can be invited
-- to a match that overlaps one they already play.
--
-- (Applied to the project with apply_migration as `match_invites`.)

create table public.match_invites (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  -- Seat 1 is the host's
  seat smallint not null check (seat between 2 and 4),
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- A pending invitation holds its seat, and a player has one per match
create unique index match_invites_seat_idx on public.match_invites (match_id, seat)
  where status = 'pending';
create unique index match_invites_invitee_idx on public.match_invites (match_id, invitee_id)
  where status = 'pending';
create index match_invites_invitee_pending_idx on public.match_invites (invitee_id)
  where status = 'pending';

alter table public.match_invites enable row level security;
revoke all on public.match_invites from anon, authenticated;
grant select on public.match_invites to authenticated;

-- Line-ups are public, so who is invited is too: the seat shows as held, not open
create policy "Signed-in players read match invitations"
  on public.match_invites for select to authenticated using (true);

alter publication supabase_realtime add table public.match_invites;

-- ---------------------------------------------------------------------------------------------
-- Notifications

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'chat_message', 'player_joined', 'match_full', 'player_left', 'court_booked',
    'court_changed', 'court_unbooked', 'match_cancelled', 'score_to_confirm', 'rate_players',
    'match_logged', 'connection_request', 'connection_accepted',
    'tournament_invite', 'tournament_invite_accepted', 'tournament_invite_declined',
    'tournament_invite_cancelled', 'tournament_invite_expired',
    'tournament_partner_left', 'tournament_promoted', 'tournament_added', 'tournament_removed',
    'match_invite', 'match_invite_declined', 'match_invite_cancelled'
  ));

alter table public.notification_outbox drop constraint notification_outbox_kind_check;
alter table public.notification_outbox add constraint notification_outbox_kind_check
  check (kind in (
    'chat_message', 'player_joined', 'match_full', 'player_left', 'court_booked',
    'court_changed', 'court_unbooked', 'match_cancelled', 'score_to_confirm', 'rate_players',
    'match_logged', 'connection_request', 'connection_accepted',
    'tournament_invite', 'tournament_invite_accepted', 'tournament_invite_declined',
    'tournament_invite_cancelled', 'tournament_invite_expired',
    'tournament_partner_left', 'tournament_promoted', 'tournament_added', 'tournament_removed',
    'match_invite', 'match_invite_declined', 'match_invite_cancelled'
  ));

-- Invitations count as match updates for the push settings
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
      'court_unbooked', 'match_cancelled', 'match_invite', 'match_invite_declined',
      'match_invite_cancelled'
    ) then v_settings.match_updates
    when p_kind in ('score_to_confirm', 'rate_players', 'match_logged') then v_settings.scores
    when p_kind in ('connection_request', 'connection_accepted') then v_settings.connections
    when p_kind like 'tournament\_%' then v_settings.tournaments
    else true
  end;
  if not v_wants or not exists (select 1 from public.push_tokens where player_id = p_player_id) then
    return;
  end if;

  insert into public.notification_outbox (player_id, kind, params, url, match_id)
  values (p_player_id, p_kind, p_params, p_url, p_match_id);
end;
$$;

-- Removes a player's "You're invited" row for a match once it can't be answered any more
create function public.match_invite_clear(p_player_id uuid, p_match_id uuid)
  returns void
  language sql
  security definer
  set search_path = ''
as $$
  delete from public.notifications
  where player_id = p_player_id and match_id = p_match_id and kind = 'match_invite';
$$;

revoke all on function public.match_invite_clear(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Inviting, answering and taking an invitation back

create function public.invite_player_to_match(p_match_id uuid, p_seat smallint, p_player_id uuid)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_gender text;
  v_invite_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;

  -- Lock the match so an invitation and a join for the same seat are handled one after the other
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'This match no longer exists';
  end if;
  if v_match.host_id <> v_uid then
    raise exception 'Only the host can invite players';
  end if;
  if v_match.status <> 'open' then
    raise exception 'This match was cancelled';
  end if;
  if v_match.starts_at <= now() then
    raise exception 'This match has already started';
  end if;
  if p_player_id = v_uid then
    raise exception 'That''s you';
  end if;

  select gender into v_gender from public.profiles where id = p_player_id;
  if not found then
    raise exception 'This player no longer exists';
  end if;

  -- Only the seats left for other players (the host and their guests take the first ones)
  if p_seat is null or p_seat < 2 or p_seat > 4 or p_seat <= 4 - v_match.players_needed then
    raise exception 'That spot isn''t open';
  end if;
  if exists (select 1 from public.match_players where match_id = p_match_id and seat = p_seat) then
    raise exception 'Someone just took that spot';
  end if;
  if exists (
    select 1 from public.match_invites
    where match_id = p_match_id and seat = p_seat and status = 'pending'
  ) then
    raise exception 'That spot is held for an invited player';
  end if;

  if exists (
    select 1 from public.match_players where match_id = p_match_id and player_id = p_player_id
  ) then
    raise exception 'That player is already in this match';
  end if;
  if exists (
    select 1 from public.match_invites
    where match_id = p_match_id and invitee_id = p_player_id and status = 'pending'
  ) then
    raise exception 'That player is already invited to this match';
  end if;

  if v_match.audience = 'men' and v_gender is distinct from 'male' then
    raise exception 'This match is for men only';
  end if;
  if v_match.audience = 'women' and v_gender is distinct from 'female' then
    raise exception 'This match is for women only';
  end if;

  if exists (
    select 1
    from public.match_players mp
    join public.matches other on other.id = mp.match_id
    where mp.player_id = p_player_id
      and other.status = 'open'
      and other.id <> p_match_id
      and other.starts_at < v_match.starts_at + interval '90 minutes'
      and v_match.starts_at < other.starts_at + interval '90 minutes'
  ) then
    raise exception 'That player already has a match at that time';
  end if;

  insert into public.match_invites (match_id, seat, invitee_id, invited_by)
  values (p_match_id, p_seat, p_player_id, v_uid)
  returning id into v_invite_id;

  perform public.queue_push(
    p_player_id, 'match_invite',
    jsonb_build_object(
      'name', coalesce((select first_name from public.profiles where id = v_uid), ''),
      'when', public.push_match_time(v_match.starts_at)
    ),
    '/match/' || p_match_id, p_match_id, v_uid
  );

  return v_invite_id;
end;
$$;

create function public.respond_to_match_invite(p_invite_id uuid, p_accept boolean)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.match_invites%rowtype;
  v_match public.matches%rowtype;
  v_gender text;
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;

  select * into v_invite from public.match_invites where id = p_invite_id;
  if not found or v_invite.invitee_id <> v_uid then
    raise exception 'This invitation is no longer waiting';
  end if;

  -- Lock the match first, like inviting and joining do, then look at the invitation again
  select * into v_match from public.matches where id = v_invite.match_id for update;
  select * into v_invite from public.match_invites where id = p_invite_id for update;
  if v_invite.status <> 'pending' then
    raise exception 'This invitation is no longer waiting';
  end if;
  if v_match.status <> 'open' then
    raise exception 'This match was cancelled';
  end if;
  if v_match.starts_at <= now() then
    raise exception 'This match has already started';
  end if;

  if not coalesce(p_accept, false) then
    update public.match_invites
    set status = 'declined', responded_at = now()
    where id = v_invite.id;
    perform public.match_invite_clear(v_uid, v_invite.match_id);
    perform public.queue_push(
      v_match.host_id, 'match_invite_declined',
      jsonb_build_object(
        'name', coalesce((select first_name from public.profiles where id = v_uid), ''),
        'when', public.push_match_time(v_match.starts_at)
      ),
      '/match/' || v_match.id, v_match.id, v_uid
    );
    return;
  end if;

  if exists (
    select 1 from public.match_players where match_id = v_match.id and player_id = v_uid
  ) then
    raise exception 'You''re already in this match';
  end if;

  select gender into v_gender from public.profiles where id = v_uid;
  if v_match.audience = 'men' and v_gender is distinct from 'male' then
    raise exception 'This match is for men only';
  end if;
  if v_match.audience = 'women' and v_gender is distinct from 'female' then
    raise exception 'This match is for women only';
  end if;

  if exists (
    select 1
    from public.match_players mp
    join public.matches other on other.id = mp.match_id
    where mp.player_id = v_uid
      and other.status = 'open'
      and other.id <> v_match.id
      and other.starts_at < v_match.starts_at + interval '90 minutes'
      and v_match.starts_at < other.starts_at + interval '90 minutes'
  ) then
    raise exception 'You already have a match at that time';
  end if;

  update public.match_invites
  set status = 'accepted', responded_at = now()
  where id = v_invite.id;
  perform public.match_invite_clear(v_uid, v_match.id);

  -- The same as joining: the host hears "X joined", and everyone hears when the match is full
  insert into public.match_players (match_id, seat, player_id)
  values (v_match.id, v_invite.seat, v_uid);
end;
$$;

create function public.cancel_match_invite(p_invite_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.match_invites%rowtype;
  v_match public.matches%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;

  select * into v_invite from public.match_invites where id = p_invite_id;
  if not found then
    raise exception 'This invitation is no longer waiting';
  end if;

  select * into v_match from public.matches where id = v_invite.match_id for update;
  if v_match.host_id <> v_uid then
    raise exception 'Only the host can invite players';
  end if;
  select * into v_invite from public.match_invites where id = p_invite_id for update;
  if v_invite.status <> 'pending' then
    raise exception 'This invitation is no longer waiting';
  end if;

  update public.match_invites
  set status = 'cancelled', responded_at = now()
  where id = v_invite.id;
  perform public.match_invite_clear(v_invite.invitee_id, v_match.id);
  perform public.queue_push(
    v_invite.invitee_id, 'match_invite_cancelled',
    jsonb_build_object(
      'name', coalesce((select first_name from public.profiles where id = v_uid), ''),
      'when', public.push_match_time(v_match.starts_at)
    ),
    '/match/' || v_match.id, v_match.id, v_uid
  );
end;
$$;

-- The invitations waiting for you, soonest match first, with the host and the match's time and
-- club. Invitations to a match that has started or was cancelled are left out.
create function public.my_match_invites()
  returns table (
    invite_id uuid,
    match_id uuid,
    seat smallint,
    created_at timestamptz,
    starts_at timestamptz,
    level_min numeric,
    level_max numeric,
    kind text,
    club_name text,
    court_number smallint,
    host_id uuid,
    host_first_name text,
    host_last_name text,
    host_level numeric,
    host_avatar_url text
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select i.id, i.match_id, i.seat, i.created_at, m.starts_at, m.level_min, m.level_max, m.kind,
         c.name, ct.number, h.id, h.first_name, h.last_name, h.level, h.avatar_url
  from public.match_invites i
  join public.matches m on m.id = i.match_id
  join public.profiles h on h.id = m.host_id
  left join public.courts ct on ct.id = m.court_id
  left join public.clubs c on c.id = ct.club_id
  where i.invitee_id = (select auth.uid())
    and i.status = 'pending'
    and m.status = 'open'
    and m.starts_at > now()
  order by m.starts_at;
$$;

revoke all on function public.invite_player_to_match(uuid, smallint, uuid) from public, anon;
revoke all on function public.respond_to_match_invite(uuid, boolean) from public, anon;
revoke all on function public.cancel_match_invite(uuid) from public, anon;
revoke all on function public.my_match_invites() from public, anon;
grant execute on function public.invite_player_to_match(uuid, smallint, uuid) to authenticated;
grant execute on function public.respond_to_match_invite(uuid, boolean) to authenticated;
grant execute on function public.cancel_match_invite(uuid) to authenticated;
grant execute on function public.my_match_invites() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Rules that already existed, now aware of invitations

-- A cancelled match ends its waiting invitations; the invited players hear it was cancelled
create function public.close_invites_of_cancelled_match()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_invite record;
begin
  if not (old.status = 'open' and new.status = 'cancelled') then
    return null;
  end if;

  for v_invite in
    update public.match_invites
    set status = 'cancelled', responded_at = now()
    where match_id = new.id and status = 'pending'
    returning invitee_id
  loop
    perform public.match_invite_clear(v_invite.invitee_id, new.id);
    perform public.queue_push(
      v_invite.invitee_id, 'match_cancelled',
      jsonb_build_object(
        'name', coalesce((select first_name from public.profiles where id = new.host_id), ''),
        'when', public.push_match_time(new.starts_at)
      ),
      '/match/' || new.id, new.id, new.host_id
    );
  end loop;
  return null;
end;
$$;

revoke all on function public.close_invites_of_cancelled_match() from public, anon, authenticated;

create trigger matches_close_invites
  after update of status on public.matches
  for each row execute function public.close_invites_of_cancelled_match();

-- join_match: a seat held for someone else can't be taken, and joining on your own closes
-- your own waiting invitation to the match
create or replace function public.join_match(p_match_id uuid, p_seat smallint)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_level numeric;
  v_gender text;
  -- A match within this distance of its range still counts as a good fit, as in the app
  c_level_margin constant numeric := 0.5;
begin
  if v_uid is null then
    raise exception 'Sign in to join a match';
  end if;

  -- Lock the match so two joins at once are handled one after the other
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'This match no longer exists';
  end if;
  if v_match.status <> 'open' then
    raise exception 'This match was cancelled';
  end if;
  if v_match.starts_at <= now() then
    raise exception 'This match has already started';
  end if;

  if p_seat is null or p_seat < 1 or p_seat > 4 or p_seat <= 4 - v_match.players_needed then
    raise exception 'That spot isn''t open';
  end if;
  if exists (
    select 1 from public.match_players where match_id = p_match_id and player_id = v_uid
  ) then
    raise exception 'You''re already in this match';
  end if;
  if exists (
    select 1 from public.match_players where match_id = p_match_id and seat = p_seat
  ) then
    raise exception 'Someone just took that spot';
  end if;
  if exists (
    select 1 from public.match_invites
    where match_id = p_match_id and seat = p_seat and status = 'pending' and invitee_id <> v_uid
  ) then
    raise exception 'That spot is held for an invited player';
  end if;

  -- A player the host invited was picked by the host, so the level range doesn't apply
  if not exists (
    select 1 from public.match_invites
    where match_id = p_match_id and invitee_id = v_uid and status = 'pending'
  ) then
    select level into v_level from public.profiles where id = v_uid;
    if v_level is not null
       and (v_level < v_match.level_min - c_level_margin or v_level > v_match.level_max + c_level_margin) then
      raise exception 'Your level is outside this match''s range';
    end if;
  end if;

  select gender into v_gender from public.profiles where id = v_uid;
  if v_match.audience = 'men' and v_gender is distinct from 'male' then
    raise exception 'This match is for men only';
  end if;
  if v_match.audience = 'women' and v_gender is distinct from 'female' then
    raise exception 'This match is for women only';
  end if;

  if exists (
    select 1
    from public.match_players mp
    join public.matches other on other.id = mp.match_id
    where mp.player_id = v_uid
      and other.status = 'open'
      and other.id <> p_match_id
      and other.starts_at < v_match.starts_at + interval '90 minutes'
      and v_match.starts_at < other.starts_at + interval '90 minutes'
  ) then
    raise exception 'You already have a match at that time';
  end if;

  -- You picked a seat yourself, so the invitation (for the same or another seat) is answered
  update public.match_invites
  set status = 'accepted', responded_at = now()
  where match_id = p_match_id and invitee_id = v_uid and status = 'pending';
  perform public.match_invite_clear(v_uid, p_match_id);

  insert into public.match_players (match_id, seat, player_id)
  values (p_match_id, p_seat, v_uid);
end;
$$;

-- The time, level and type are locked while anyone besides the host has joined or been
-- invited, so nobody answers an invitation for a match that then changes
create or replace function public.check_match_edit()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  -- Admin tools and our own functions may change anything
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if new.starts_at is not distinct from old.starts_at
     and new.level_min is not distinct from old.level_min
     and new.level_max is not distinct from old.level_max
     and new.kind is not distinct from old.kind
     and new.audience is not distinct from old.audience
     and new.court_id is not distinct from old.court_id then
    return new;
  end if;

  if old.status <> 'open' then
    raise exception 'This match was cancelled';
  end if;
  if old.starts_at <= now() then
    raise exception 'This match has already started';
  end if;

  if new.starts_at is distinct from old.starts_at
     or new.level_min is distinct from old.level_min
     or new.level_max is distinct from old.level_max
     or new.kind is distinct from old.kind
     or new.audience is distinct from old.audience then
    if exists (
      select 1 from public.match_players
      where match_id = old.id and player_id <> old.host_id
    ) or exists (
      select 1 from public.match_invites
      where match_id = old.id and status = 'pending'
    ) then
      raise exception 'Players have joined or been invited, so the time, level and type can''t change';
    end if;
    if new.starts_at <= now() then
      raise exception 'Pick a time that hasn''t passed';
    end if;
  end if;
  return new;
end;
$$;
