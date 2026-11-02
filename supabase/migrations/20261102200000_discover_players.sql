-- Players to discover for someone with no matches yet: players within one level
-- of you that you aren't connected to, your city and closest level first, with
-- the side they play and when they joined. Internal helpers stay private; this
-- returns the same public card as the other player lists (no phone or private details).

create function public.get_discover_players()
  returns table (
    id uuid, first_name text, last_name text, city text, level numeric, avatar_url text,
    connection text, club_name text, mutual_count integer, side text, joined_at timestamptz
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with me as (
    select level, city from public.profiles where id = auth.uid()
  ),
  candidates as (
    select p.id, p.first_name, p.last_name, p.city, p.level, p.avatar_url,
           public.connection_status(auth.uid(), p.id) as connection,
           (select pm.club_name from public.played_matches() pm
            where pm.player_id = p.id and pm.club_name is not null
            order by pm.played_at desc limit 1) as club_name,
           public.mutual_connection_count(auth.uid(), p.id) as mutual_count,
           p.side, p.created_at as joined_at
    from public.profiles p
    cross join me
    where p.id <> auth.uid()
      and (me.level is null or p.level is null or abs(p.level - me.level) <= 1)
  )
  select * from candidates
  where connection <> 'connected'
  order by (city is not distinct from (select city from me)) desc,
           abs(coalesce(level, 0) - coalesce((select level from me), 0)),
           joined_at desc
  limit 30;
$$;

revoke all on function public.get_discover_players() from public, anon;
grant execute on function public.get_discover_players() to authenticated;
