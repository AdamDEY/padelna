-- Push notifications. The app saves each phone's Expo push token; triggers put a row in
-- notification_outbox for every player who should hear about something; the send-push
-- Edge Function turns those rows into pushes, in each phone's language.
--
-- Players can switch each kind off in Edit profile (notification_settings). Chat pushes
-- are grouped: at most one per match chat until you open it, and never more often than
-- every few minutes.

create extension if not exists pg_net with schema extensions;

-- One row per phone. A token moves to whoever signed in last on that phone.
create table public.push_tokens (
  token text primary key check (token like 'ExponentPushToken[%]' or token like 'ExpoPushToken[%]'),
  player_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  -- Language the app was in, so pushes read the same as the app
  language text not null default 'en' check (language in ('en', 'fr')),
  updated_at timestamptz not null default now()
);

create index push_tokens_player_idx on public.push_tokens (player_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

-- What each player wants to hear about. No row = everything on.
create table public.notification_settings (
  player_id uuid primary key references public.profiles (id) on delete cascade,
  -- New messages in your match chats
  chat boolean not null default true,
  -- Joins, leaves, a full match, court booked, cancelled
  match_updates boolean not null default true,
  -- A score to confirm, players to rate
  scores boolean not null default true,
  -- Connection requests and accepted requests
  connections boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;
revoke all on public.notification_settings from anon, authenticated;
grant select, insert (player_id, chat, match_updates, scores, connections),
  update (chat, match_updates, scores, connections) on public.notification_settings to authenticated;

create policy "Players read their notification settings"
  on public.notification_settings for select to authenticated
  using ((select auth.uid()) = player_id);
create policy "Players create their notification settings"
  on public.notification_settings for insert to authenticated
  with check ((select auth.uid()) = player_id);
create policy "Players change their notification settings"
  on public.notification_settings for update to authenticated
  using ((select auth.uid()) = player_id)
  with check ((select auth.uid()) = player_id);

create trigger notification_settings_set_updated_at
  before update on public.notification_settings
  for each row execute function public.set_updated_at();

-- Pushes waiting to go out, and a record of the ones that went. Only the Edge Function
-- (service role) reads it; the text is written there, from `kind` and `params`.
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'chat_message', 'player_joined', 'match_full', 'player_left', 'court_booked',
    'match_cancelled', 'score_to_confirm', 'rate_players', 'connection_request',
    'connection_accepted'
  )),
  params jsonb not null default '{}',
  -- App route opened when the push is tapped
  url text not null,
  match_id uuid references public.matches (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Set while the Edge Function sends it, so two runs don't send it twice
  claimed_at timestamptz,
  sent_at timestamptz,
  error text
);

create index notification_outbox_pending_idx on public.notification_outbox (created_at) where sent_at is null;
create index notification_outbox_chat_idx on public.notification_outbox (player_id, match_id, created_at desc)
  where kind = 'chat_message';

alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;

-- The app saves its token after sign-in and whenever it changes
create function public.register_push_token(p_token text, p_platform text, p_language text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  insert into public.push_tokens (token, player_id, platform, language)
  values (p_token, auth.uid(), p_platform, coalesce(p_language, 'en'))
  on conflict (token) do update set
    player_id = excluded.player_id,
    platform = excluded.platform,
    language = excluded.language,
    updated_at = now();
end;
$$;

-- Signing out stops pushes to this phone
create function public.unregister_push_token(p_token text)
  returns void
  language sql
  security definer
  set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and player_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Wakes the send-push Edge Function. pg_net sends the request after the transaction
-- commits, so a slow push never holds up a join or a message.
create function public.wake_push_sender()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://phanktfbxpcyprwcudyb.supabase.co/functions/v1/send-push',
    body := '{}'::jsonb,
    headers := '{"content-type": "application/json"}'::jsonb
  );
  return null;
end;
$$;

revoke all on function public.wake_push_sender() from public, anon, authenticated;

create trigger notification_outbox_wake_sender
  after insert on public.notification_outbox
  for each statement execute function public.wake_push_sender();

-- Queues a push for one player, if they want this kind and have a phone to send it to
create function public.queue_push(
  p_player_id uuid,
  p_kind text,
  p_params jsonb,
  p_url text,
  p_match_id uuid default null
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

revoke all on function public.queue_push(uuid, text, jsonb, text, uuid) from public, anon, authenticated;

-- The match's start in Tunis time ("2026-10-25T18:00"); the Edge Function writes it
-- out as "Sat 25 Oct · 18:00" in the phone's language.
create function public.push_match_time(p_starts_at timestamptz)
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select to_char(p_starts_at at time zone 'Africa/Tunis', 'YYYY-MM-DD"T"HH24:MI');
$$;

-- Chat messages and the notes the chat adds for joins, leaves, bookings and cancellations
create function public.push_match_message()
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
        '/match/' || new.match_id || '/chat', new.match_id);
    elsif new.kind = 'joined' and v_player.player_id = v_match.host_id then
      perform public.queue_push(v_player.player_id, 'player_joined', v_params,
        '/match/' || new.match_id, new.match_id);
    elsif new.kind = 'joined_full' then
      perform public.queue_push(v_player.player_id, 'match_full', v_params,
        '/match/' || new.match_id, new.match_id);
    elsif new.kind = 'left' and v_player.player_id = v_match.host_id then
      perform public.queue_push(v_player.player_id, 'player_left', v_params,
        '/match/' || new.match_id, new.match_id);
    elsif new.kind = 'court_booked' then
      perform public.queue_push(v_player.player_id, 'court_booked', v_params,
        '/match/' || new.match_id, new.match_id);
    elsif new.kind = 'cancelled' then
      perform public.queue_push(v_player.player_id, 'match_cancelled', v_params,
        '/match/' || new.match_id, new.match_id);
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.push_match_message() from public, anon, authenticated;

create trigger match_messages_push
  after insert on public.match_messages
  for each row execute function public.push_match_message();

-- A new or corrected score: the other team confirms it, the sender's partner can rate
create function public.push_match_score()
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
        '/match/' || new.match_id, new.match_id);
    elsif tg_op = 'INSERT' then
      perform public.queue_push(v_player.player_id, 'rate_players', v_params,
        '/match/' || new.match_id || '/rate', new.match_id);
    end if;
  end loop;
  return null;
end;
$$;

revoke all on function public.push_match_score() from public, anon, authenticated;

create trigger match_scores_push
  after insert or update on public.match_scores
  for each row execute function public.push_match_score();

-- Connection requests, and the requester hearing that it was accepted
create function public.push_connection()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.queue_push(new.addressee_id, 'connection_request',
      jsonb_build_object('name', (select first_name from public.profiles where id = new.requester_id)),
      '/players');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.queue_push(new.requester_id, 'connection_accepted',
      jsonb_build_object('name', (select first_name from public.profiles where id = new.addressee_id)),
      '/players');
  end if;
  return null;
end;
$$;

revoke all on function public.push_connection() from public, anon, authenticated;

create trigger connections_push
  after insert or update of status on public.connections
  for each row execute function public.push_connection();

-- For the Edge Function: takes up to 100 waiting pushes (one per phone) and marks them
-- as being sent. A claim older than a few minutes is taken again, in case a run died.
create function public.claim_pushes(p_limit integer default 100)
  returns table (
    outbox_id uuid,
    token text,
    language text,
    kind text,
    params jsonb,
    url text
  )
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  with claimed as (
    update public.notification_outbox o
    set claimed_at = now()
    where o.id in (
      select id from public.notification_outbox
      where sent_at is null
        and (claimed_at is null or claimed_at < now() - interval '5 minutes')
        -- Pushes that couldn't go out within a day are dropped
        and created_at > now() - interval '1 day'
      order by created_at
      limit p_limit
      for update skip locked
    )
    returning o.id
  )
  select array_agg(id) into v_ids from claimed;

  -- The player signed out of every phone since it was queued
  update public.notification_outbox o
  set sent_at = now(), error = 'No phone to send to'
  where o.id = any (v_ids)
    and not exists (select 1 from public.push_tokens t where t.player_id = o.player_id);

  return query
  select o.id, t.token, t.language, o.kind, o.params, o.url
  from public.notification_outbox o
  join public.push_tokens t on t.player_id = o.player_id
  where o.id = any (v_ids) and o.sent_at is null;
end;
$$;

-- For the Edge Function: records how each claimed push went
create function public.finish_pushes(p_sent uuid[], p_failed jsonb, p_dead_tokens text[])
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.notification_outbox set sent_at = now(), error = null where id = any (p_sent);
  update public.notification_outbox o
  set sent_at = now(), error = f.error
  from jsonb_to_recordset(p_failed) as f (id uuid, error text)
  where o.id = f.id;
  -- Expo says these phones uninstalled the app or turned pushes off for good
  delete from public.push_tokens where token = any (p_dead_tokens);
end;
$$;

revoke all on function public.claim_pushes(integer) from public, anon, authenticated;
revoke all on function public.finish_pushes(uuid[], jsonb, text[]) from public, anon, authenticated;
grant execute on function public.claim_pushes(integer) to service_role;
grant execute on function public.finish_pushes(uuid[], jsonb, text[]) to service_role;

-- If a wake-up was missed, waiting pushes still go out within a minute
select cron.schedule(
  'send-waiting-pushes',
  '* * * * *',
  $$select net.http_post(
      url := 'https://phanktfbxpcyprwcudyb.supabase.co/functions/v1/send-push',
      body := '{}'::jsonb,
      headers := '{"content-type": "application/json"}'::jsonb
    )
    where exists (
      select 1 from public.notification_outbox
      where sent_at is null and created_at > now() - interval '1 day'
    )$$
);
