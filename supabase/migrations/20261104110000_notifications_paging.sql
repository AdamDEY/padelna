-- The notifications list loads a page at a time: the newest first, older ones on request.
-- It can also be limited to one tab (matches or friends), and the unread counts for the
-- tabs and the Home bell come from their own cheap query instead of the loaded list.

drop function public.my_notifications(integer);

create function public.my_notifications(
  p_limit integer default 20,
  -- Only rows older than this, for the next page
  p_before timestamptz default null,
  -- 'matches', 'friends' or null for everything
  p_group text default null
)
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
    and (p_before is null or n.created_at < p_before)
    and (
      p_group is null
      or (p_group = 'friends' and n.kind in ('connection_request', 'connection_accepted'))
      or (p_group = 'matches' and n.kind not in ('connection_request', 'connection_accepted'))
    )
  order by n.created_at desc, n.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

create function public.my_unread_notification_counts()
  returns table (matches integer, friends integer)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select
    (count(*) filter (where kind not in ('connection_request', 'connection_accepted')))::integer,
    (count(*) filter (where kind in ('connection_request', 'connection_accepted')))::integer
  from public.notifications
  where player_id = (select auth.uid())
    and read_at is null
    and created_at > now() - interval '60 days';
$$;

revoke all on function public.my_notifications(integer, timestamptz, text) from public, anon;
revoke all on function public.my_unread_notification_counts() from public, anon;
grant execute on function public.my_notifications(integer, timestamptz, text) to authenticated;
grant execute on function public.my_unread_notification_counts() to authenticated;
