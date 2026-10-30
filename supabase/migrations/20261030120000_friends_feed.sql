-- Community · Friends: confirmed results of matches where you or at least one
-- of your friends played. Uploading a team photo means sharing it with the
-- community, so any signed-in player can now see match photos.

drop policy "Players read their match photos" on storage.objects;

create policy "Signed-in players read match photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'match-photos');

-- One row per match, newest confirmation first. `p_before` pages through the
-- feed: pass the last row's confirmed_at to get the next page.
-- Each player comes with the public card only (no phone) and how you relate to them.
create function public.get_friends_feed(p_before timestamptz default null, p_limit integer default 20)
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
  feed as (
    select s.*, m.starts_at, m.kind, m.level_min, m.level_max, m.court_id
    from public.match_scores s
    join public.matches m on m.id = s.match_id
    where s.status = 'confirmed'
      and m.status = 'open'
      and (p_before is null or s.confirmed_at < p_before)
      and exists (
        select 1 from public.match_players mp
        where mp.match_id = s.match_id
          and (mp.player_id = auth.uid() or mp.player_id in (select id from friends))
      )
    order by s.confirmed_at desc
    limit least(greatest(p_limit, 1), 50)
  )
  select
    f.match_id,
    f.starts_at,
    f.confirmed_at,
    cl.name,
    ct.number,
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
  left join public.courts ct on ct.id = f.court_id
  left join public.clubs cl on cl.id = ct.club_id
  where auth.uid() is not null
  order by f.confirmed_at desc;
$$;

revoke all on function public.get_friends_feed(timestamptz, integer) from public, anon;
grant execute on function public.get_friends_feed(timestamptz, integer) to authenticated;
