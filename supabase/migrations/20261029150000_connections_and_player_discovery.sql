-- Connections between players, and the Players screen's suggestions.
--
-- Connecting is two-way: one player sends a request, the other accepts it.
-- Writes go through request_connection and respond_to_connection only;
-- connections has no insert, update or delete policy on purpose.
--
-- "Played" means a match that is over and had all 4 seats taken (the host's
-- guests count). A club becomes one of your clubs once you've played a match
-- at a court there.

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

-- One connection per pair of players, whoever asked
create unique index connections_pair_idx
  on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index connections_addressee_idx on public.connections (addressee_id, status);

alter table public.connections enable row level security;

create policy "Players read their own connections"
  on public.connections for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- Every finished, full match each player played in, with its club.
-- Internal: only the functions below use it.
create function public.played_matches()
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
        = m.players_needed + 1;
$$;

-- How the signed-in player relates to another: 'none', 'sent' (you asked),
-- 'received' (they asked) or 'connected'. Internal.
create function public.connection_status(p_me uuid, p_other uuid)
  returns text
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(
    (select case
              when c.status = 'accepted' then 'connected'
              when c.requester_id = p_me then 'sent'
              else 'received'
            end
     from public.connections c
     where least(c.requester_id, c.addressee_id) = least(p_me, p_other)
       and greatest(c.requester_id, c.addressee_id) = greatest(p_me, p_other)),
    'none');
$$;

-- Friends two players have in common. Internal.
create function public.mutual_connection_count(p_a uuid, p_b uuid)
  returns integer
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with friends as (
    select case when requester_id = p_a then addressee_id else requester_id end as friend_id, p_a as of_player
    from public.connections where status = 'accepted' and p_a in (requester_id, addressee_id)
    union all
    select case when requester_id = p_b then addressee_id else requester_id end, p_b
    from public.connections where status = 'accepted' and p_b in (requester_id, addressee_id)
  )
  select count(*)::integer from (
    select friend_id from friends group by friend_id having count(distinct of_player) = 2
  ) both_friends;
$$;

revoke all on function public.played_matches() from public, anon, authenticated;
revoke all on function public.connection_status(uuid, uuid) from public, anon, authenticated;
revoke all on function public.mutual_connection_count(uuid, uuid) from public, anon, authenticated;

-- The clubs where you've played, most played first.
create function public.get_my_clubs()
  returns table (club_id text, club_name text, match_count integer, last_played_at timestamptz)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select club_id, club_name, count(*)::integer, max(played_at)
  from public.played_matches()
  where player_id = auth.uid() and club_id is not null
  group by club_id, club_name
  order by count(*) desc, max(played_at) desc;
$$;

-- Columns every player list returns: the public card plus how you relate to them
-- (the phone and the rest of the profile stay private, as in get_player_cards).

-- People you played with that you aren't connected to yet, most recent first.
create function public.get_played_with()
  returns table (
    id uuid, first_name text, last_name text, city text, level numeric, avatar_url text,
    connection text, club_name text, mutual_count integer
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with mine as (
    select match_id from public.played_matches() where player_id = auth.uid()
  ),
  others as (
    select pm.player_id, max(pm.played_at) as last_played_at,
           (array_agg(pm.club_name order by pm.played_at desc))[1] as club_name
    from public.played_matches() pm
    join mine on mine.match_id = pm.match_id
    where pm.player_id <> auth.uid()
    group by pm.player_id
  )
  select p.id, p.first_name, p.last_name, p.city, p.level, p.avatar_url,
         public.connection_status(auth.uid(), p.id), o.club_name,
         public.mutual_connection_count(auth.uid(), p.id)
  from others o
  join public.profiles p on p.id = o.player_id
  where public.connection_status(auth.uid(), p.id) <> 'connected'
  order by o.last_played_at desc
  limit 12;
$$;

-- Players who play at your clubs, within half a level of you, that you neither
-- know nor played with yet. Friends in common first.
create function public.get_players_at_my_clubs()
  returns table (
    id uuid, first_name text, last_name text, city text, level numeric, avatar_url text,
    connection text, club_name text, mutual_count integer
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with me as (
    select level from public.profiles where id = auth.uid()
  ),
  my_clubs as (
    select distinct club_id from public.played_matches()
    where player_id = auth.uid() and club_id is not null
  ),
  played_with as (
    select distinct pm.player_id
    from public.played_matches() pm
    where pm.match_id in (select match_id from public.played_matches() where player_id = auth.uid())
  ),
  regulars as (
    select pm.player_id,
           (array_agg(pm.club_name order by pm.played_at desc))[1] as club_name
    from public.played_matches() pm
    where pm.club_id in (select club_id from my_clubs)
      and pm.player_id <> auth.uid()
      and pm.player_id not in (select player_id from played_with)
    group by pm.player_id
  ),
  candidates as (
    select p.id, p.first_name, p.last_name, p.city, p.level, p.avatar_url,
           public.connection_status(auth.uid(), p.id) as connection, r.club_name,
           public.mutual_connection_count(auth.uid(), p.id) as mutual_count
    from regulars r
    join public.profiles p on p.id = r.player_id
    cross join me
    -- Same rule as a "good fit" in the app: within half a level
    where me.level is null or p.level is null or abs(p.level - me.level) <= 0.5
  )
  select * from candidates
  where connection <> 'connected'
  order by mutual_count desc, abs(coalesce(level, 0) - coalesce((select level from me), 0)), first_name
  limit 20;
$$;

-- Connection requests waiting for you, newest first.
create function public.get_connection_requests()
  returns table (
    id uuid, first_name text, last_name text, city text, level numeric, avatar_url text,
    connection text, club_name text, mutual_count integer
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p.id, p.first_name, p.last_name, p.city, p.level, p.avatar_url,
         'received'::text,
         (select pm.club_name from public.played_matches() pm
          where pm.player_id = p.id and pm.club_name is not null
          order by pm.played_at desc limit 1),
         public.mutual_connection_count(auth.uid(), p.id)
  from public.connections c
  join public.profiles p on p.id = c.requester_id
  where c.addressee_id = auth.uid() and c.status = 'pending'
  order by c.created_at desc;
$$;

-- Players whose name, or a club they've played at, matches the search.
create function public.search_players(p_query text)
  returns table (
    id uuid, first_name text, last_name text, city text, level numeric, avatar_url text,
    connection text, club_name text, mutual_count integer
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with q as (
    select '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  ),
  clubs_played as (
    select pm.player_id,
           (array_agg(pm.club_name order by pm.played_at desc))[1] as last_club,
           array_agg(distinct pm.club_name) as club_names
    from public.played_matches() pm
    where pm.club_name is not null
    group by pm.player_id
  )
  select p.id, p.first_name, p.last_name, p.city, p.level, p.avatar_url,
         public.connection_status(auth.uid(), p.id), cp.last_club,
         public.mutual_connection_count(auth.uid(), p.id)
  from public.profiles p
  cross join q
  left join clubs_played cp on cp.player_id = p.id
  where char_length(btrim(p_query)) >= 2
    and p.id <> auth.uid()
    and (
      p.first_name || ' ' || p.last_name ilike q.pattern
      or exists (select 1 from unnest(cp.club_names) as club_name where club_name ilike q.pattern)
    )
  order by p.first_name, p.last_name
  limit 20;
$$;

-- Sends a connection request, or accepts theirs if they already asked you.
create function public.request_connection(p_player_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.connections%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;
  if p_player_id = v_uid then
    raise exception 'That''s you';
  end if;
  if not exists (select 1 from public.profiles where id = p_player_id) then
    raise exception 'This player no longer exists';
  end if;

  select * into v_existing from public.connections
  where least(requester_id, addressee_id) = least(v_uid, p_player_id)
    and greatest(requester_id, addressee_id) = greatest(v_uid, p_player_id)
  for update;

  if not found then
    insert into public.connections (requester_id, addressee_id) values (v_uid, p_player_id);
  elsif v_existing.status = 'accepted' then
    raise exception 'You''re already connected';
  elsif v_existing.requester_id = p_player_id then
    update public.connections set status = 'accepted', responded_at = now() where id = v_existing.id;
  end if;
  -- Otherwise you already asked: nothing to do
end;
$$;

-- Accepts or declines a request someone sent you. Declining removes it, so they can ask again later.
create function public.respond_to_connection(p_player_id uuid, p_accept boolean)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;

  if p_accept then
    update public.connections set status = 'accepted', responded_at = now()
    where requester_id = p_player_id and addressee_id = v_uid and status = 'pending';
  else
    delete from public.connections
    where requester_id = p_player_id and addressee_id = v_uid and status = 'pending';
  end if;
  if not found then
    raise exception 'This request is no longer waiting';
  end if;
end;
$$;

revoke all on function public.get_my_clubs() from public, anon;
revoke all on function public.get_played_with() from public, anon;
revoke all on function public.get_players_at_my_clubs() from public, anon;
revoke all on function public.get_connection_requests() from public, anon;
revoke all on function public.search_players(text) from public, anon;
revoke all on function public.request_connection(uuid) from public, anon;
revoke all on function public.respond_to_connection(uuid, boolean) from public, anon;
grant execute on function public.get_my_clubs() to authenticated;
grant execute on function public.get_played_with() to authenticated;
grant execute on function public.get_players_at_my_clubs() to authenticated;
grant execute on function public.get_connection_requests() to authenticated;
grant execute on function public.search_players(text) to authenticated;
grant execute on function public.request_connection(uuid) to authenticated;
grant execute on function public.respond_to_connection(uuid, boolean) to authenticated;

-- A new request shows up on the Players screen without reloading
alter publication supabase_realtime add table public.connections;
