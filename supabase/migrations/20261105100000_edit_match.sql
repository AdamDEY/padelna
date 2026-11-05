-- Hosts edit their match before it starts. The time, level and type can change only while
-- nobody else has joined (players signed up for those). The court can change at any time
-- before the start, and everyone in the line-up gets a chat note and a notification.

create function public.check_match_edit()
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
     or new.kind is distinct from old.kind then
    if exists (
      select 1 from public.match_players
      where match_id = old.id and player_id <> old.host_id
    ) then
      raise exception 'Players have joined, so the time, level and type can''t change';
    end if;
    if new.starts_at <= now() then
      raise exception 'Pick a time that hasn''t passed';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.check_match_edit() from public, anon, authenticated;

create trigger matches_check_edit
  before update of starts_at, level_min, level_max, kind, court_id on public.matches
  for each row execute function public.check_match_edit();

-- Chat notes for a court that changed or is no longer booked
alter table public.match_messages drop constraint match_messages_kind_check;
alter table public.match_messages add constraint match_messages_kind_check
  check (kind in (
    'text', 'joined', 'joined_full', 'left', 'court_booked', 'court_changed', 'court_unbooked',
    'cancelled'
  ));

create or replace function public.note_match_change()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if old.status = 'open' and new.status = 'cancelled' then
    insert into public.match_messages (match_id, sender_id, kind)
    values (new.id, new.host_id, 'cancelled');
  elsif old.court_id is null and new.court_id is not null then
    insert into public.match_messages (match_id, sender_id, kind)
    values (new.id, new.host_id, 'court_booked');
  elsif old.court_id is not null and new.court_id is null then
    insert into public.match_messages (match_id, sender_id, kind)
    values (new.id, new.host_id, 'court_unbooked');
  elsif old.court_id is distinct from new.court_id then
    insert into public.match_messages (match_id, sender_id, kind)
    values (new.id, new.host_id, 'court_changed');
  end if;
  return null;
end;
$$;

-- The same two events as pushes and in-app notifications
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'chat_message', 'player_joined', 'match_full', 'player_left', 'court_booked',
    'court_changed', 'court_unbooked', 'match_cancelled', 'score_to_confirm', 'rate_players',
    'connection_request', 'connection_accepted'
  ));

alter table public.notification_outbox drop constraint notification_outbox_kind_check;
alter table public.notification_outbox add constraint notification_outbox_kind_check
  check (kind in (
    'chat_message', 'player_joined', 'match_full', 'player_left', 'court_booked',
    'court_changed', 'court_unbooked', 'match_cancelled', 'score_to_confirm', 'rate_players',
    'connection_request', 'connection_accepted'
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
    when p_kind in ('score_to_confirm', 'rate_players') then v_settings.scores
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

create or replace function public.push_match_message()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_sender text;
  v_player record;
  v_params jsonb;
  -- A chat push is skipped if one went out this recently and you haven't opened the chat since
  c_chat_quiet constant interval := interval '5 minutes';
begin
  select * into v_match from public.matches where id = new.match_id;
  if not found then
    return null;
  end if;
  select first_name into v_sender from public.profiles where id = new.sender_id;
  v_params := jsonb_build_object(
    'name', coalesce(v_sender, ''),
    'when', public.push_match_time(v_match.starts_at),
    'body', left(new.body, 140)
  );

  for v_player in
    select mp.player_id,
           (select last_read_at from public.match_chat_reads r
            where r.match_id = new.match_id and r.player_id = mp.player_id) as last_read_at
    from public.match_players mp
    where mp.match_id = new.match_id and mp.player_id is distinct from new.sender_id
  loop
    if new.kind = 'text' then
      -- The list counts every message; the push below is grouped
      perform public.add_chat_notification(v_player.player_id, new.match_id, new.sender_id, v_params);
      -- Grouped: one push until you open the chat, and not more often than every few minutes
      if exists (
        select 1 from public.notification_outbox o
        where o.player_id = v_player.player_id
          and o.match_id = new.match_id
          and o.kind = 'chat_message'
          and o.created_at > coalesce(v_player.last_read_at, '-infinity'::timestamptz)
          and o.created_at > now() - c_chat_quiet
      ) then
        continue;
      end if;
      perform public.queue_push(v_player.player_id, 'chat_message', v_params,
        '/match/' || new.match_id || '/chat', new.match_id, new.sender_id);
    elsif new.kind = 'joined' and v_player.player_id = v_match.host_id then
      perform public.queue_push(v_player.player_id, 'player_joined', v_params,
        '/match/' || new.match_id, new.match_id, new.sender_id);
    elsif new.kind = 'joined_full' then
      perform public.queue_push(v_player.player_id, 'match_full', v_params,
        '/match/' || new.match_id, new.match_id, new.sender_id);
    elsif new.kind = 'left' and v_player.player_id = v_match.host_id then
      perform public.queue_push(v_player.player_id, 'player_left', v_params,
        '/match/' || new.match_id, new.match_id, new.sender_id);
    elsif new.kind in ('court_booked', 'court_changed', 'court_unbooked') then
      perform public.queue_push(v_player.player_id, new.kind, v_params,
        '/match/' || new.match_id, new.match_id, new.sender_id);
    elsif new.kind = 'cancelled' then
      perform public.queue_push(v_player.player_id, 'match_cancelled', v_params,
        '/match/' || new.match_id, new.match_id, new.sender_id);
    end if;
  end loop;
  return null;
end;
$$;
