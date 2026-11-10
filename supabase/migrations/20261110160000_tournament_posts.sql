-- Tournament result posts in the Community feeds.
--
-- A player who finished a tournament can post their result from the share sheet. The post only
-- stores who posted, which tournament and an optional caption: the card (finish, scores, place) is
-- worked out in the app from get_tournament_live, so nobody can post a result they didn't get.
--
-- Where a post shows follows the matches: Friends has the posts of you, your friends and the
-- partner they played with; My clubs and All Tunisia leave those out, so a post is in one circle
-- only. My clubs has the tournaments held at a club you've played at; All Tunisia has the rest.

create table public.tournament_posts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  caption text check (caption is null or char_length(caption) <= 140),
  created_at timestamptz not null default now(),
  -- One post per player and tournament; posting again only changes the caption
  unique (tournament_id, author_id)
);

create index tournament_posts_created_idx on public.tournament_posts (created_at desc);

-- Players only go through the functions below
alter table public.tournament_posts enable row level security;

-- Posts the result of a finished tournament I held a spot in. Posting again updates the caption.
create function public.post_tournament_result(p_tournament_id uuid, p_caption text default null)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_caption text := nullif(btrim(coalesce(p_caption, '')), '');
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Sign in to post your result';
  end if;
  if v_caption is not null and char_length(v_caption) > 140 then
    raise exception 'That caption is too long';
  end if;
  if not exists (select 1 from public.tournaments t where t.id = p_tournament_id and t.status = 'finished') then
    raise exception 'This tournament isn''t finished yet';
  end if;
  if not exists (
    select 1 from public.tournament_entries e
    where e.tournament_id = p_tournament_id and e.status = 'confirmed' and v_me in (e.player1_id, e.player2_id)
  ) then
    raise exception 'You are not in this tournament';
  end if;

  insert into public.tournament_posts (tournament_id, author_id, caption)
  values (p_tournament_id, v_me, v_caption)
  on conflict (tournament_id, author_id) do update set caption = excluded.caption
  returning id into v_id;
  return v_id;
end;
$$;

-- p_scope: 'friends', 'clubs' (p_filter = club id) or 'tunisia' (p_filter = city)
create function public.tournament_post_feed(
  p_scope text,
  p_filter text,
  p_before timestamptz,
  p_limit integer
)
  returns table (
    post_id uuid,
    tournament_id uuid,
    created_at timestamptz,
    caption text,
    author jsonb,
    partner jsonb
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
  posts as (
    select
      p.id, p.tournament_id, p.created_at, p.caption, p.author_id, t.club_id, cl.city,
      -- The other player of the author's pair, when they played in one
      (select case when e.player1_id = p.author_id then e.player2_id else e.player1_id end
       from public.tournament_entries e
       where e.tournament_id = p.tournament_id and e.status = 'confirmed'
         and p.author_id in (e.player1_id, e.player2_id)
       limit 1) as partner_id
    from public.tournament_posts p
    join public.tournaments t on t.id = p.tournament_id
    left join public.clubs cl on cl.id = t.club_id
    where t.status = 'finished'
      and (p_before is null or p.created_at < p_before)
  ),
  scoped as (
    select po.*
    from posts po
    cross join lateral (
      select (
        po.author_id = auth.uid() or po.author_id in (select id from friends)
        or po.partner_id = auth.uid() or po.partner_id in (select id from friends)
      ) as in_circle
    ) circle
    where auth.uid() is not null
      and case p_scope
        when 'friends' then circle.in_circle
        when 'clubs' then not circle.in_circle
          and po.club_id in (select club_id from my_clubs)
          and (p_filter is null or po.club_id = p_filter)
        -- A tournament without a club has no city, so it only shows under all cities
        when 'tunisia' then not circle.in_circle and (p_filter is null or po.city = p_filter)
        else false
      end
    order by po.created_at desc
    limit least(greatest(p_limit, 1), 50)
  )
  select
    s.id,
    s.tournament_id,
    s.created_at,
    s.caption,
    (select jsonb_build_object(
        'id', a.id, 'first_name', a.first_name, 'last_name', a.last_name, 'level', a.level,
        'avatar_url', a.avatar_url, 'connection', public.connection_status(auth.uid(), a.id))
     from public.profiles a where a.id = s.author_id),
    (select jsonb_build_object(
        'id', b.id, 'first_name', b.first_name, 'last_name', b.last_name, 'level', b.level,
        'avatar_url', b.avatar_url, 'connection', public.connection_status(auth.uid(), b.id))
     from public.profiles b where b.id = s.partner_id)
  from scoped s
  order by s.created_at desc;
$$;

create function public.get_friends_tournament_posts(p_before timestamptz default null, p_limit integer default 20)
  returns table (post_id uuid, tournament_id uuid, created_at timestamptz, caption text, author jsonb, partner jsonb)
  language sql
  stable
  security definer
  set search_path = ''
as $$ select * from public.tournament_post_feed('friends', null, p_before, p_limit); $$;

create function public.get_clubs_tournament_posts(p_club_id text default null, p_before timestamptz default null, p_limit integer default 20)
  returns table (post_id uuid, tournament_id uuid, created_at timestamptz, caption text, author jsonb, partner jsonb)
  language sql
  stable
  security definer
  set search_path = ''
as $$ select * from public.tournament_post_feed('clubs', p_club_id, p_before, p_limit); $$;

create function public.get_tunisia_tournament_posts(p_city text default null, p_before timestamptz default null, p_limit integer default 20)
  returns table (post_id uuid, tournament_id uuid, created_at timestamptz, caption text, author jsonb, partner jsonb)
  language sql
  stable
  security definer
  set search_path = ''
as $$ select * from public.tournament_post_feed('tunisia', p_city, p_before, p_limit); $$;

revoke all on function public.tournament_post_feed(text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.post_tournament_result(uuid, text) from public, anon;
revoke all on function public.get_friends_tournament_posts(timestamptz, integer) from public, anon;
revoke all on function public.get_clubs_tournament_posts(text, timestamptz, integer) from public, anon;
revoke all on function public.get_tunisia_tournament_posts(text, timestamptz, integer) from public, anon;
grant execute on function public.post_tournament_result(uuid, text) to authenticated;
grant execute on function public.get_friends_tournament_posts(timestamptz, integer) to authenticated;
grant execute on function public.get_clubs_tournament_posts(text, timestamptz, integer) to authenticated;
grant execute on function public.get_tunisia_tournament_posts(text, timestamptz, integer) to authenticated;
