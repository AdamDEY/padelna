-- Tournament history on the Profile.
--
-- The tournament tables have no player policies, so the app can't list the tournaments a player
-- finished by itself. This returns them, newest first, in the same shape as get_tournaments so the
-- app reads both the same way. Only entries holding a spot count (a pair or a drawn player), not
-- an invite, the waitlist or the partner list. The recap of each one comes from get_tournament_live,
-- which already returns finished tournaments.

create function public.get_my_tournament_history(p_limit integer default 50)
  returns table (
    id uuid, name text, format text, status text, category text, entry_mode text,
    starts_at timestamptz, club_name text, capacity integer, entries_count integer,
    spots_left integer, waitlist_count integer, registration_open boolean, my_status text
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select
    t.id, t.name, t.format, t.status, t.category, t.settings ->> 'entry_mode', t.starts_at, c.name,
    t.capacity::integer,
    (select count(*)::integer from public.tournament_entries e where e.tournament_id = t.id),
    null::integer,
    0,
    false,
    mine.status
  from public.tournaments t
  left join public.clubs c on c.id = t.club_id
  join lateral (
    select e.status
    from public.tournament_entries e
    where e.tournament_id = t.id
      and auth.uid() in (e.player1_id, e.player2_id)
      and e.status = 'confirmed'
    limit 1
  ) mine on true
  where auth.uid() is not null
    and t.status = 'finished'
  order by t.starts_at desc nulls last, t.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.get_my_tournament_history(integer) from public, anon;
grant execute on function public.get_my_tournament_history(integer) to authenticated;
