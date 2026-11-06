-- Players who have played a full match at a club can review it: stars for the court
-- (surface, glass, lighting) and the club (gear, changing rooms, staff), a few tags from a
-- fixed list and a comment. One review per player per club; sending it again replaces it.
-- Reviews show the author's name, like the club reviews in the design.

create table public.club_reviews (
  id uuid primary key default gen_random_uuid(),
  club_id text not null references public.clubs (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- The court they played on, when they said
  court_id uuid references public.courts (id) on delete set null,
  surface smallint check (surface between 1 and 5),
  glass smallint check (glass between 1 and 5),
  lighting smallint check (lighting between 1 and 5),
  gear smallint check (gear between 1 and 5),
  rooms smallint check (rooms between 1 and 5),
  staff smallint check (staff between 1 and 5),
  tags text[] not null default '{}',
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, author_id),
  -- Something has to be rated
  check (num_nonnulls(surface, glass, lighting, gear, rooms, staff) > 0)
);

create index club_reviews_club_idx on public.club_reviews (club_id, updated_at desc);

alter table public.club_reviews enable row level security;

-- Reads and writes go through the functions below
revoke all on public.club_reviews from anon, authenticated;
grant select on public.club_reviews to authenticated;

create policy "Admins read club reviews"
  on public.club_reviews for select to authenticated
  using ((select public.is_admin()));

-- Rate a club. Replaces your earlier review of it.
create function public.submit_club_review(
  p_club_id text,
  p_court_id uuid default null,
  p_surface smallint default null,
  p_glass smallint default null,
  p_lighting smallint default null,
  p_gear smallint default null,
  p_rooms smallint default null,
  p_staff smallint default null,
  p_tags text[] default '{}',
  p_comment text default ''
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  -- What players can flag about a club. Keep in sync with src/data/club-review-tags.ts
  c_tags constant text[] := array[
    'Fresh turf', 'True bounce', 'Good AC', 'Great lighting', 'Clean glass', 'Friendly staff',
    'Easy booking', 'Sea breeze', 'Worn rental rackets', 'Flat balls', 'Slippery turf', 'Windy',
    'Hard to park', 'Small changing rooms', 'Dim evening light'
  ];
  c_max_tags constant int := 5;
  v_tags text[] := coalesce(p_tags, '{}');
  v_comment text := btrim(coalesce(p_comment, ''));
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;

  if not exists (select 1 from public.clubs where id = p_club_id) then
    raise exception 'This club no longer exists';
  end if;

  if not exists (
    select 1 from public.played_matches() m where m.player_id = v_uid and m.club_id = p_club_id
  ) then
    raise exception 'Play a match at this club to review it';
  end if;

  if p_court_id is not null
     and not exists (select 1 from public.courts where id = p_court_id and club_id = p_club_id) then
    raise exception 'That court isn''t at this club';
  end if;

  if num_nonnulls(p_surface, p_glass, p_lighting, p_gear, p_rooms, p_staff) = 0 then
    raise exception 'Rate at least one thing';
  end if;
  if exists (
    select 1 from unnest(array[p_surface, p_glass, p_lighting, p_gear, p_rooms, p_staff]) as s
    where s is not null and s not between 1 and 5
  ) then
    raise exception 'Pick between 1 and 5 stars';
  end if;

  if exists (select 1 from unnest(v_tags) as tag where not (tag = any (c_tags))) then
    raise exception 'Pick tags from the list';
  end if;
  if (select count(distinct tag) from unnest(v_tags) as tag) > c_max_tags then
    raise exception 'Pick up to 5 tags for a club';
  end if;
  if char_length(v_comment) > 500 then
    raise exception 'Keep your comment under 500 characters';
  end if;

  insert into public.club_reviews (
    club_id, author_id, court_id, surface, glass, lighting, gear, rooms, staff, tags, comment
  )
  values (
    p_club_id, v_uid, p_court_id, p_surface, p_glass, p_lighting, p_gear, p_rooms, p_staff,
    (select coalesce(array_agg(distinct tag), '{}') from unnest(v_tags) as tag), v_comment
  )
  on conflict (club_id, author_id) do update set
    court_id = excluded.court_id,
    surface = excluded.surface,
    glass = excluded.glass,
    lighting = excluded.lighting,
    gear = excluded.gear,
    rooms = excluded.rooms,
    staff = excluded.staff,
    tags = excluded.tags,
    comment = excluded.comment,
    updated_at = now();
end;
$$;

-- A review's overall score: the average of the things the player rated. Internal.
create function public.club_review_rating(r public.club_reviews)
  returns numeric
  language sql
  immutable
  set search_path = ''
as $$
  select (coalesce(r.surface, 0) + coalesce(r.glass, 0) + coalesce(r.lighting, 0)
          + coalesce(r.gear, 0) + coalesce(r.rooms, 0) + coalesce(r.staff, 0))::numeric
         / num_nonnulls(r.surface, r.glass, r.lighting, r.gear, r.rooms, r.staff);
$$;

revoke all on function public.club_review_rating(public.club_reviews) from public, anon, authenticated;

-- The numbers at the top of the reviews: overall score, average per thing, what players
-- flag most and the average per court. One row, even when nobody has reviewed yet.
create function public.get_club_ratings(p_club_id text)
  returns table (
    review_count integer,
    rating numeric,
    surface numeric,
    glass numeric,
    lighting numeric,
    gear numeric,
    rooms numeric,
    staff numeric,
    tags jsonb,
    courts jsonb
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with reviews as (
    select r.*, public.club_review_rating(r) as overall
    from public.club_reviews r
    where r.club_id = p_club_id and (select auth.uid()) is not null
  )
  select
    (select count(*)::integer from reviews),
    (select avg(overall) from reviews),
    (select avg(surface) from reviews),
    (select avg(glass) from reviews),
    (select avg(lighting) from reviews),
    (select avg(gear) from reviews),
    (select avg(rooms) from reviews),
    (select avg(staff) from reviews),
    coalesce((
      select jsonb_agg(jsonb_build_object('tag', t.tag, 'count', t.n) order by t.n desc, t.tag)
      from (select tag, count(*) as n from reviews, unnest(reviews.tags) as tag group by tag) t
    ), '[]'::jsonb),
    -- Average of the court scores (surface, glass, lighting) for each court that has any
    coalesce((
      select jsonb_agg(jsonb_build_object('number', c.number, 'rating', c.avg_rating) order by c.number)
      from (
        select co.number,
               avg((coalesce(r.surface, 0) + coalesce(r.glass, 0) + coalesce(r.lighting, 0))::numeric
                   / num_nonnulls(r.surface, r.glass, r.lighting)) as avg_rating
        from reviews r
        join public.courts co on co.id = r.court_id
        where num_nonnulls(r.surface, r.glass, r.lighting) > 0
        group by co.number
      ) c
    ), '[]'::jsonb);
$$;

-- Newest first. Each review comes with how often its author has played here.
create function public.get_club_reviews(p_club_id text, p_limit integer default 50)
  returns table (
    id uuid,
    author_id uuid,
    first_name text,
    last_name text,
    avatar_url text,
    level numeric,
    city text,
    court_number smallint,
    court_indoor boolean,
    surface smallint,
    glass smallint,
    lighting smallint,
    gear smallint,
    rooms smallint,
    staff smallint,
    rating numeric,
    tags text[],
    comment text,
    posted_at timestamptz,
    times_played integer
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select
    r.id, r.author_id, p.first_name, p.last_name, p.avatar_url, p.level, p.city,
    co.number, co.indoor,
    r.surface, r.glass, r.lighting, r.gear, r.rooms, r.staff,
    public.club_review_rating(r), r.tags, r.comment, r.updated_at,
    (select count(*)::integer from public.played_matches() m
      where m.player_id = r.author_id and m.club_id = r.club_id)
  from public.club_reviews r
  join public.profiles p on p.id = r.author_id
  left join public.courts co on co.id = r.court_id
  where r.club_id = p_club_id and (select auth.uid()) is not null
  order by r.updated_at desc
  limit greatest(least(p_limit, 100), 1);
$$;

revoke all on function public.submit_club_review(text, uuid, smallint, smallint, smallint, smallint, smallint, smallint, text[], text) from public, anon;
revoke all on function public.get_club_ratings(text) from public, anon;
revoke all on function public.get_club_reviews(text, integer) from public, anon;
grant execute on function public.submit_club_review(text, uuid, smallint, smallint, smallint, smallint, smallint, smallint, text[], text) to authenticated;
grant execute on function public.get_club_ratings(text) to authenticated;
grant execute on function public.get_club_reviews(text, integer) to authenticated;
