-- Players can see tournaments that are open for entries (still in 'setup'), soonest first.
-- The tables stay closed to players; this returns only what the Home card shows. Tournaments
-- have no level yet, so every signed-in player sees them all.

create function public.get_upcoming_tournaments(p_limit integer default 5)
  returns table (
    id uuid, name text, format text, category text, starts_at timestamptz, club_name text
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select t.id, t.name, t.format, t.category, t.starts_at, c.name
  from public.tournaments t
  left join public.clubs c on c.id = t.club_id
  where auth.uid() is not null
    and t.status = 'setup'
    and (t.starts_at is null or t.starts_at > now() - interval '1 day')
  order by t.starts_at nulls last, t.created_at desc
  limit least(greatest(p_limit, 1), 20);
$$;

revoke all on function public.get_upcoming_tournaments(integer) from public, anon;
grant execute on function public.get_upcoming_tournaments(integer) to authenticated;
