-- Community · My clubs and All Tunisia now leave out matches you or one of your friends
-- played; those show in the Friends tab, so no match appears in more than one tab.
create or replace function public.community_feed(
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
      -- The Friends tab already shows every match you or a friend played, so the other two
      -- tabs show only matches nobody in your circle played (Connect still works on them)
      and (p_scope = 'friends' or not exists (
        select 1 from public.match_players mp
        where mp.match_id = s.match_id
          and (mp.player_id = auth.uid() or mp.player_id in (select id from friends))
      ))
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

-- The All Tunisia city filter lists only cities that still have a match left to show
create or replace function public.get_community_cities()
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
    and not exists (
      select 1 from public.match_players mp
      where mp.match_id = s.match_id
        and (mp.player_id = auth.uid() or mp.player_id in (
          select case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end
          from public.connections c
          where c.status = 'accepted' and auth.uid() in (c.requester_id, c.addressee_id)
        ))
    )
  group by cl.city
  order by count(*) desc, cl.city;
$$;
