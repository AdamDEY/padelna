-- Players list: filter by gender and show it. 'unknown' finds players who set up before gender
-- was asked (profiles.gender is nullable). The return type changes, so the function is replaced.
drop function public.admin_list_players(text, text, numeric, numeric, boolean, text, integer, integer);

-- One row per player. matches_played counts the same way as played_matches(): over, all
-- four seats taken. total_count is the number of players matching the filters, for paging.
create function public.admin_list_players(
  p_search text default null,
  p_city text default null,
  p_level_min numeric default null,
  p_level_max numeric default null,
  p_has_reports boolean default false,
  p_sort text default 'newest',
  p_limit integer default 25,
  p_offset integer default 0,
  p_gender text default null
)
  returns table (
    id uuid, first_name text, last_name text, phone text, city text, level numeric,
    gender text, avatar_url text, created_at timestamptz, matches_played integer,
    last_match_at timestamptz, report_count integer, total_count bigint
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_search text := public.admin_search_text(btrim(coalesce(p_search, '')));
  v_words text[] := array(select w from unnest(regexp_split_to_array(v_search, '\s+')) w where w <> '');
  -- A phone search: only digits, with or without +216 in front
  v_digits text := regexp_replace(coalesce(p_search, ''), '[\s+.-]', '', 'g');
begin
  perform public.assert_admin();

  if p_sort not in ('newest', 'name', 'level', 'matches') then
    raise exception 'Unknown sort: %', p_sort;
  end if;
  if p_gender is not null and p_gender not in ('', 'male', 'female', 'unknown') then
    raise exception 'Gender must be male, female or unknown';
  end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'Page size must be 1 to 100';
  end if;

  if v_digits ~ '^[0-9]+$' and length(v_digits) > 8 and left(v_digits, 3) = '216' then
    v_digits := substr(v_digits, 4);
  end if;

  return query
  with played as (
    select pm.player_id, count(*)::integer as n, max(pm.played_at) as last_at
    from public.played_matches() pm
    group by pm.player_id
  ),
  reports as (
    select r.reported_id, count(*)::integer as n
    from public.player_reports r
    group by r.reported_id
  ),
  filtered as (
    select
      p.id, p.first_name, p.last_name, p.phone, p.city, p.level, p.gender, p.avatar_url, p.created_at,
      coalesce(pl.n, 0) as matches_played,
      pl.last_at as last_match_at,
      coalesce(rp.n, 0) as report_count
    from public.profiles p
    left join played pl on pl.player_id = p.id
    left join reports rp on rp.reported_id = p.id
    where (
        cardinality(v_words) = 0
        or (
          v_digits ~ '^[0-9]{3,}$' and p.phone like '%' || v_digits || '%'
        )
        or (
          not (v_digits ~ '^[0-9]+$')
          and not exists (
            select 1 from unnest(v_words) w
            where position(w in public.admin_search_text(p.first_name || ' ' || p.last_name)) = 0
          )
        )
      )
      and (p_city is null or p_city = '' or p.city = p_city)
      and (
        p_gender is null or p_gender = ''
        or (p_gender = 'unknown' and p.gender is null)
        or p.gender = p_gender
      )
      and (p_level_min is null or p.level >= p_level_min)
      and (p_level_max is null or p.level <= p_level_max)
      and (not coalesce(p_has_reports, false) or coalesce(rp.n, 0) > 0)
  )
  select
    f.id, f.first_name, f.last_name, f.phone, f.city, f.level, f.gender, f.avatar_url, f.created_at,
    f.matches_played, f.last_match_at, f.report_count,
    count(*) over ()
  from filtered f
  order by
    case when p_sort = 'name' then public.admin_search_text(f.last_name || ' ' || f.first_name) end asc,
    case when p_sort = 'level' then f.level end desc nulls last,
    case when p_sort = 'matches' then f.matches_played end desc,
    f.created_at desc,
    f.id
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.admin_list_players(text, text, numeric, numeric, boolean, text, integer, integer, text)
  from public, anon;
grant execute on function public.admin_list_players(text, text, numeric, numeric, boolean, text, integer, integer, text)
  to authenticated;

