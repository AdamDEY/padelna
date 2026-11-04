-- In-app notifications: the list behind the Home bell.
--
-- Every event that sends a push (queue_push) also adds a row here, whatever the push
-- settings say, so the list is complete even with pushes off. Chat messages are grouped:
-- one unread row per match, with a count, until the player opens that chat.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  -- Same kinds as the push outbox
  kind text not null check (kind in (
    'chat_message', 'player_joined', 'match_full', 'player_left', 'court_booked',
    'match_cancelled', 'score_to_confirm', 'rate_players', 'connection_request',
    'connection_accepted'
  )),
  -- Who it's about (the sender, joiner or requester); null if their account is gone
  actor_id uuid references public.profiles (id) on delete set null,
  match_id uuid references public.matches (id) on delete cascade,
  -- First name, the match time and, for chats, the message count
  params jsonb not null default '{}',
  -- App route the row opens
  url text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_player_idx on public.notifications (player_id, created_at desc);
create index notifications_unread_idx on public.notifications (player_id) where read_at is null;

-- Lets a new chat message bump the unread row instead of adding another
create unique index notifications_unread_chat_idx
  on public.notifications (player_id, match_id)
  where kind = 'chat_message' and read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

create policy "Players read their notifications"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = player_id);

alter publication supabase_realtime add table public.notifications;

-- The list: newest first, with the person's name and photo and the match's time and club.
-- Security definer because players can only read their own profile directly.
create function public.my_notifications(p_limit integer default 100)
  returns table (
    id uuid,
    kind text,
    created_at timestamptz,
    read_at timestamptz,
    params jsonb,
    url text,
    match_id uuid,
    actor_id uuid,
    actor_first_name text,
    actor_last_name text,
    actor_avatar_url text,
    starts_at timestamptz,
    club_name text
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select n.id, n.kind, n.created_at, n.read_at, n.params, n.url, n.match_id,
         n.actor_id, p.first_name, p.last_name, p.avatar_url,
         m.starts_at, c.name
  from public.notifications n
  left join public.profiles p on p.id = n.actor_id
  left join public.matches m on m.id = n.match_id
  left join public.courts ct on ct.id = m.court_id
  left join public.clubs c on c.id = ct.club_id
  where n.player_id = (select auth.uid())
    -- Older ones drop off the list
    and n.created_at > now() - interval '60 days'
  order by n.created_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- Marks the given notifications (yours only) as read
create function public.mark_notifications_read(p_ids uuid[])
  returns void
  language sql
  security definer
  set search_path = ''
as $$
  update public.notifications
  set read_at = now()
  where player_id = (select auth.uid()) and id = any (p_ids) and read_at is null;
$$;

create function public.mark_all_notifications_read()
  returns void
  language sql
  security definer
  set search_path = ''
as $$
  update public.notifications
  set read_at = now()
  where player_id = (select auth.uid()) and read_at is null;
$$;

revoke all on function public.my_notifications(integer) from public, anon;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.my_notifications(integer) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Opening a match chat reads its notification
create function public.read_chat_notification()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.notifications
  set read_at = now()
  where player_id = new.player_id and match_id = new.match_id
    and kind = 'chat_message' and read_at is null;
  return null;
end;
$$;

revoke all on function public.read_chat_notification() from public, anon, authenticated;

create trigger match_chat_reads_notification
  after insert or update on public.match_chat_reads
  for each row execute function public.read_chat_notification();

-- One unread row per match for chat messages; each new message bumps its count and time
create function public.add_chat_notification(p_player_id uuid, p_match_id uuid, p_sender_id uuid, p_params jsonb)
  returns void
  language sql
  security definer
  set search_path = ''
as $$
  insert into public.notifications as n (player_id, kind, actor_id, match_id, params, url)
  values (p_player_id, 'chat_message', p_sender_id, p_match_id,
          p_params || jsonb_build_object('count', 1), '/match/' || p_match_id || '/chat')
  on conflict (player_id, match_id) where kind = 'chat_message' and read_at is null
  do update set
    actor_id = excluded.actor_id,
    params = excluded.params
      || jsonb_build_object('count', coalesce((n.params ->> 'count')::integer, 1) + 1),
    created_at = now();
$$;

revoke all on function public.add_chat_notification(uuid, uuid, uuid, jsonb) from public, anon, authenticated;

-- queue_push now also adds the in-app row (not for chats, which add_chat_notification
-- handles), and takes who the event is about.
drop function public.queue_push(uuid, text, jsonb, text, uuid);

create function public.queue_push(
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
    when p_kind in ('player_joined', 'match_full', 'player_left', 'court_booked', 'match_cancelled')
      then v_settings.match_updates
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

revoke all on function public.queue_push(uuid, text, jsonb, text, uuid, uuid) from public, anon, authenticated;

-- The three push triggers, now telling queue_push who each event is about
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
    elsif new.kind = 'court_booked' then
      perform public.queue_push(v_player.player_id, 'court_booked', v_params,
        '/match/' || new.match_id, new.match_id, new.sender_id);
    elsif new.kind = 'cancelled' then
      perform public.queue_push(v_player.player_id, 'match_cancelled', v_params,
        '/match/' || new.match_id, new.match_id, new.sender_id);
    end if;
  end loop;
  return null;
end;
$$;

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
      perform public.queue_push(v_player.player_id, 'score_to_confirm', v_params,
        '/match/' || new.match_id, new.match_id, new.submitted_by);
    elsif tg_op = 'INSERT' then
      perform public.queue_push(v_player.player_id, 'rate_players', v_params,
        '/match/' || new.match_id || '/rate', new.match_id, new.submitted_by);
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.push_connection()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.queue_push(new.addressee_id, 'connection_request',
      jsonb_build_object('name', (select first_name from public.profiles where id = new.requester_id)),
      '/players', null, new.requester_id);
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.queue_push(new.requester_id, 'connection_accepted',
      jsonb_build_object('name', (select first_name from public.profiles where id = new.addressee_id)),
      '/players', null, new.addressee_id);
  end if;
  return null;
end;
$$;
