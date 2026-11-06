-- Players say what stood out when they rate someone: a few tags from a fixed list
-- ("Fair play", "Strong smash"...). Anonymous like the ratings: a player reads only the
-- tags they gave, and everyone sees how many players said each tag about a player.

create table public.player_rating_tags (
  match_id uuid not null,
  rater_id uuid not null,
  rated_id uuid not null,
  tag text not null,
  primary key (match_id, rater_id, rated_id, tag),
  foreign key (match_id, rater_id, rated_id)
    references public.player_ratings (match_id, rater_id, rated_id) on delete cascade
);

create index player_rating_tags_rated_idx on public.player_rating_tags (rated_id, tag);

alter table public.player_rating_tags enable row level security;

-- Writes go through submit_ratings only
revoke all on public.player_rating_tags from anon, authenticated;
grant select on public.player_rating_tags to authenticated;

create policy "Players read the tags they gave"
  on public.player_rating_tags for select to authenticated
  using ((select auth.uid()) = rater_id);

create policy "Admins read tags"
  on public.player_rating_tags for select to authenticated
  using ((select public.is_admin()));

-- "What players say": how many players gave each tag, most first. Counts only, never who.
create function public.get_player_tags(p_player_id uuid)
  returns table (tag text, count bigint)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select t.tag, count(*) as count
  from public.player_rating_tags t
  where t.rated_id = p_player_id and (select auth.uid()) is not null
  group by t.tag
  order by count(*) desc, t.tag;
$$;

revoke all on function public.get_player_tags(uuid) from public, anon;
grant execute on function public.get_player_tags(uuid) to authenticated;

drop function public.submit_ratings(uuid, uuid[], smallint[]);

create function public.submit_ratings(
  p_match_id uuid,
  p_player_ids uuid[],
  p_ratings smallint[],
  p_tags jsonb default '{}'::jsonb
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_score public.match_scores%rowtype;
  v_count int := coalesce(array_length(p_player_ids, 1), 0);
  -- Same as settle_match_levels
  c_rating_window constant interval := interval '3 days';
  -- What players can say about each other. Keep in sync with src/data/player-tags.ts
  c_tags constant text[] := array[
    'fair_play', 'great_teammate', 'positive_vibes', 'calm_under_pressure', 'respectful',
    'on_time', 'great_communication', 'strong_smash', 'solid_at_the_net', 'great_defence',
    'consistent', 'strong_serve', 'smart_tactics', 'great_lobs', 'good_bandeja', 'fighter',
    'quick_on_court', 'good_wall_play'
  ];
  -- Most tags one player can give another
  c_max_tags constant int := 5;
  v_entry record;
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;

  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'This match no longer exists';
  end if;
  if v_match.status <> 'open' then
    raise exception 'This match was cancelled';
  end if;

  if v_match.kind <> 'competitive' then
    raise exception 'Friendly matches aren''t rated';
  end if;

  if not exists (select 1 from public.match_players where match_id = p_match_id and player_id = v_uid) then
    raise exception 'Only players in this match can rate it';
  end if;

  select * into v_score from public.match_scores where match_id = p_match_id;
  if not found then
    raise exception 'You can rate the players once the score is added';
  end if;
  if v_score.status = 'pending' and now() > v_score.expires_at then
    raise exception 'This score wasn''t confirmed in time, so the match can''t be rated';
  end if;
  if v_score.status = 'confirmed' and now() > v_score.confirmed_at + c_rating_window then
    raise exception 'It''s too late to rate this match';
  end if;

  if exists (select 1 from public.player_ratings where match_id = p_match_id and rater_id = v_uid) then
    raise exception 'You already rated this match';
  end if;

  if v_count = 0 or coalesce(array_length(p_ratings, 1), 0) <> v_count then
    raise exception 'Rate at least one player';
  end if;
  if (select count(distinct id) from unnest(p_player_ids) as id) <> v_count then
    raise exception 'Each player can be rated once';
  end if;
  if v_uid = any (p_player_ids) then
    raise exception 'You can''t rate yourself';
  end if;
  if exists (select 1 from unnest(p_ratings) as r where r is null or r not between -2 and 2) then
    raise exception 'Pick a rating for each player';
  end if;
  if (select count(*) from public.match_players where match_id = p_match_id and player_id = any (p_player_ids))
     <> v_count then
    raise exception 'You can only rate players from this match';
  end if;

  if p_tags is null or jsonb_typeof(p_tags) <> 'object' then
    raise exception 'Pick tags from the list';
  end if;
  for v_entry in select key, value from jsonb_each(p_tags) loop
    if jsonb_typeof(v_entry.value) <> 'array'
       or not exists (select 1 from unnest(p_player_ids) as id where id::text = v_entry.key) then
      raise exception 'Pick tags from the list';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_entry.value) as item (tag)
      where jsonb_typeof(item.tag) <> 'string' or not ((item.tag #>> '{}') = any (c_tags))
    ) then
      raise exception 'Pick tags from the list';
    end if;
    if (select count(distinct item.tag #>> '{}') from jsonb_array_elements(v_entry.value) as item (tag)) > c_max_tags then
      raise exception 'Pick up to 5 tags for each player';
    end if;
  end loop;

  insert into public.player_ratings (match_id, rater_id, rated_id, rating)
  select p_match_id, v_uid, rated.id, rated.rating
  from unnest(p_player_ids, p_ratings) as rated (id, rating);

  insert into public.player_rating_tags (match_id, rater_id, rated_id, tag)
  select distinct p_match_id, v_uid, entry.key::uuid, item.tag #>> '{}'
  from jsonb_each(p_tags) as entry, jsonb_array_elements(entry.value) as item (tag);

  -- The last player to rate can settle the levels right away
  perform public.settle_match_levels(p_match_id);
end;
$$;

revoke all on function public.submit_ratings(uuid, uuid[], smallint[], jsonb) from public, anon;
grant execute on function public.submit_ratings(uuid, uuid[], smallint[], jsonb) to authenticated;
