-- Community · My clubs and All Tunisia: the same confirmed results as the Friends
-- feed, picked by club or city instead of by friends. All three feeds now share one
-- internal function so their rows have the same shape.

-- Confirmed matches for one feed, newest confirmation first. Internal.
-- `p_scope` is 'friends' (you or a friend played), 'clubs' (at your clubs, or the club
-- in `p_filter`) or 'tunisia' (everywhere, or the city in `p_filter`).
create function public.community_feed(
  p_scope text,
  p_filter text,
  p_before timestamptz,
  p_limit integer
)
  returns table (
    match_id uuid,
    played_at timestamptz,
    confirmed_at timestamptz,
    club_name text,
    court_number smallint,
    kind text,
    level_min numeric,
    level_max numeric,
    team1_games smallint[],
    team2_games smallint[],
    photo_path text,
    players jsonb
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with friends as (
    select case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end as id
    from public.connections c
    where c.status = 'accepted' and auth.uid() in (c.requester_id, c.addressee_id)
  ),
  my_clubs as (
    select distinct pm.club_id from public.played_matches() pm
    where pm.player_id = auth.uid() and pm.club_id is not null
  ),
  feed as (
    select s.match_id, m.starts_at, s.confirmed_at, cl.name as club_name, ct.number as court_number,
           m.kind, m.level_min, m.level_max, s.team1_games, s.team2_games, s.photo_path
    from public.match_scores s
    join public.matches m on m.id = s.match_id
    left join public.courts ct on ct.id = m.court_id
    left join public.clubs cl on cl.id = ct.club_id
    where s.status = 'confirmed'
      and m.status = 'open'
      and (p_before is null or s.confirmed_at < p_before)
      and case p_scope
        when 'friends' then exists (
          select 1 from public.match_players mp
          where mp.match_id = s.match_id
            and (mp.player_id = auth.uid() or mp.player_id in (select id from friends))
        )
        when 'clubs' then ct.club_id in (select club_id from my_clubs)
          and (p_filter is null or ct.club_id = p_filter)
        -- A match without a booked court has no city, so it only shows under all cities
        when 'tunisia' then p_filter is null or cl.city = p_filter
        else false
      end
    order by s.confirmed_at desc
    limit least(greatest(p_limit, 1), 50)
  )
  select
    f.match_id,
    f.starts_at,
    f.confirmed_at,
    f.club_name,
    f.court_number,
    f.kind,
    f.level_min,
    f.level_max,
    f.team1_games,
    f.team2_games,
    f.photo_path,
    (select jsonb_agg(jsonb_build_object(
        'seat', mp.seat,
        'id', p.id,
        'first_name', p.first_name,
        'last_name', p.last_name,
        'level', p.level,
        'avatar_url', p.avatar_url,
        'connection', public.connection_status(auth.uid(), p.id)
      ) order by mp.seat)
     from public.match_players mp
     join public.profiles p on p.id = mp.player_id
     where mp.match_id = f.match_id)
  from feed f
  where auth.uid() is not null
  order by f.confirmed_at desc;
$$;

revoke all on function public.community_feed(text, text, timestamptz, integer) from public, anon, authenticated;

create or replace function public.get_friends_feed(p_before timestamptz default null, p_limit integer default 20)
  returns table (
    match_id uuid,
    played_at timestamptz,
    confirmed_at timestamptz,
    club_name text,
    court_number smallint,
    kind text,
    level_min numeric,
    level_max numeric,
    team1_games smallint[],
    team2_games smallint[],
    photo_path text,
    players jsonb
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select * from public.community_feed('friends', null, p_before, p_limit);
$$;

-- Confirmed matches at the clubs where you've played, or at one of them.
create function public.get_clubs_feed(
  p_club_id text default null,
  p_before timestamptz default null,
  p_limit integer default 20
)
  returns table (
    match_id uuid,
    played_at timestamptz,
    confirmed_at timestamptz,
    club_name text,
    court_number smallint,
    kind text,
    level_min numeric,
    level_max numeric,
    team1_games smallint[],
    team2_games smallint[],
    photo_path text,
    players jsonb
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select * from public.community_feed('clubs', p_club_id, p_before, p_limit);
$$;

-- Confirmed matches anywhere in Tunisia, or at clubs in one city.
create function public.get_tunisia_feed(
  p_city text default null,
  p_before timestamptz default null,
  p_limit integer default 20
)
  returns table (
    match_id uuid,
    played_at timestamptz,
    confirmed_at timestamptz,
    club_name text,
    court_number smallint,
    kind text,
    level_min numeric,
    level_max numeric,
    team1_games smallint[],
    team2_games smallint[],
    photo_path text,
    players jsonb
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select * from public.community_feed('tunisia', p_city, p_before, p_limit);
$$;

-- Cities with at least one confirmed result, busiest first, for the All Tunisia filter.
create function public.get_community_cities()
  returns table (city text)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select cl.city
  from public.match_scores s
  join public.matches m on m.id = s.match_id
  join public.courts ct on ct.id = m.court_id
  join public.clubs cl on cl.id = ct.club_id
  where s.status = 'confirmed' and m.status = 'open' and cl.city <> ''
    and auth.uid() is not null
  group by cl.city
  order by count(*) desc, cl.city;
$$;

-- This week (Monday, Tunisian time) at your clubs: full matches played, and open
-- matches still to come whose level range includes yours and that you're not in.
create function public.get_clubs_week()
  returns table (matches_played integer, open_for_your_level integer)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with my_clubs as (
    select distinct pm.club_id from public.played_matches() pm
    where pm.player_id = auth.uid() and pm.club_id is not null
  ),
  week_start as (
    select date_trunc('week', now() at time zone 'Africa/Tunis') at time zone 'Africa/Tunis' as at
  )
  select
    (select count(distinct pm.match_id)::integer
     from public.played_matches() pm, week_start w
     where pm.club_id in (select club_id from my_clubs) and pm.played_at >= w.at),
    (select count(*)::integer
     from public.matches m
     join public.courts ct on ct.id = m.court_id
     where m.status = 'open'
       and m.starts_at > now()
       and ct.club_id in (select club_id from my_clubs)
       and (select level from public.profiles where id = auth.uid()) between m.level_min and m.level_max
       and (select count(*) from public.match_players mp where mp.match_id = m.id) < m.players_needed + 1
       and not exists (
         select 1 from public.match_players mp where mp.match_id = m.id and mp.player_id = auth.uid()
       ))
  where auth.uid() is not null;
$$;

-- Players whose level went up most from matches in the last 30 days, biggest gain first.
-- Same public card as the other player lists, plus the gain.
create function public.get_rising_players(p_limit integer default 10)
  returns table (
    id uuid, first_name text, last_name text, city text, level numeric, avatar_url text,
    connection text, club_name text, mutual_count integer, level_change numeric
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with gains as (
    select lh.player_id, sum(lh.new_level - coalesce(lh.old_level, lh.new_level)) as change
    from public.level_history lh
    where lh.cause = 'match' and lh.created_at >= now() - interval '30 days'
    group by lh.player_id
    having sum(lh.new_level - coalesce(lh.old_level, lh.new_level)) > 0
  )
  select p.id, p.first_name, p.last_name, p.city, p.level, p.avatar_url,
         public.connection_status(auth.uid(), p.id), null::text,
         public.mutual_connection_count(auth.uid(), p.id), g.change
  from gains g
  join public.profiles p on p.id = g.player_id
  where auth.uid() is not null and p.id <> auth.uid()
  order by g.change desc, p.level desc nulls last
  limit least(greatest(p_limit, 1), 20);
$$;

revoke all on function public.get_clubs_feed(text, timestamptz, integer) from public, anon;
revoke all on function public.get_tunisia_feed(text, timestamptz, integer) from public, anon;
revoke all on function public.get_community_cities() from public, anon;
revoke all on function public.get_clubs_week() from public, anon;
revoke all on function public.get_rising_players(integer) from public, anon;
grant execute on function public.get_clubs_feed(text, timestamptz, integer) to authenticated;
grant execute on function public.get_tunisia_feed(text, timestamptz, integer) to authenticated;
grant execute on function public.get_community_cities() to authenticated;
grant execute on function public.get_clubs_week() to authenticated;
grant execute on function public.get_rising_players(integer) to authenticated;
