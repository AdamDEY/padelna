-- Your friends for the My friends screen: everyone you're connected to, with
-- how many full matches you've played together (on either team) and when you
-- last did. The same public card as the other player lists (no phone or
-- private details).

create function public.get_my_friends()
  returns table (
    id uuid, first_name text, last_name text, city text, level numeric, avatar_url text,
    matches_together integer, last_played_at timestamptz, connected_at timestamptz
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with friends as (
    select case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end as friend_id,
           coalesce(c.responded_at, c.created_at) as connected_at
    from public.connections c
    where c.status = 'accepted' and auth.uid() in (c.requester_id, c.addressee_id)
  ),
  mine as (
    select match_id from public.played_matches() where player_id = auth.uid()
  ),
  together as (
    select pm.player_id, count(*)::integer as matches_together, max(pm.played_at) as last_played_at
    from public.played_matches() pm
    join mine on mine.match_id = pm.match_id
    where pm.player_id <> auth.uid()
    group by pm.player_id
  )
  select p.id, p.first_name, p.last_name, p.city, p.level, p.avatar_url,
         coalesce(t.matches_together, 0), t.last_played_at, f.connected_at
  from friends f
  join public.profiles p on p.id = f.friend_id
  left join together t on t.player_id = f.friend_id
  order by coalesce(t.matches_together, 0) desc, f.connected_at desc;
$$;

revoke all on function public.get_my_friends() from public, anon;
grant execute on function public.get_my_friends() to authenticated;
