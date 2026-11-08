-- Admin dashboard, Overview: every number and chart on the page, in one read-only call.
--
-- p_range picks the chart buckets: 'days' = the last 7 days, 'weeks' = the last 9 weeks
-- (Monday to Sunday), 'months' = the last 6 months. All buckets use Tunisian time.
-- p_city (optional) limits players by their city and matches by their club's city; a match
-- with no court booked has no city, so a city filter leaves it out.
-- The four KPI tiles always compare the last 7 days with the 7 days before.
-- "Played" follows played_matches(): over, all seats taken, and a match logged afterwards
-- only once its score is confirmed.
-- "Needs attention" is about the whole product, so the city filter doesn't apply to it.
create function public.admin_overview_stats(p_range text default 'weeks', p_city text default null)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  c_tz constant text := 'Africa/Tunis';
  v_unit text;
  v_count integer;
  v_step interval;
  v_now timestamptz := now();
  v_now_local timestamp := now() at time zone 'Africa/Tunis';
  v_first timestamp;
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_result jsonb;
begin
  perform public.assert_admin();

  case p_range
    when 'days' then v_unit := 'day'; v_count := 7; v_step := interval '1 day';
    when 'weeks' then v_unit := 'week'; v_count := 9; v_step := interval '1 week';
    when 'months' then v_unit := 'month'; v_count := 6; v_step := interval '1 month';
    else raise exception 'Range must be days, weeks or months';
  end case;

  v_first := date_trunc(v_unit, v_now_local) - (v_count - 1) * v_step;

  with
  m as (
    select
      ma.id, ma.created_at, ma.starts_at, ma.kind, ma.status, ma.origin,
      ma.players_needed + 1 as seats_total,
      (select count(*) from public.match_players mp where mp.match_id = ma.id) as filled,
      c.city as club_city, c.id as club_id, s.status as score_status,
      ma.starts_at + make_interval(mins => ma.duration_minutes) as ends_at
    from public.matches ma
    left join public.courts ct on ct.id = ma.court_id
    left join public.clubs c on c.id = ct.club_id
    left join public.match_scores s on s.match_id = ma.id
    where v_city is null or c.city = v_city
  ),
  mm as (
    select m.*,
      (m.status = 'open' and m.ends_at <= v_now and m.filled = m.seats_total
        and (m.origin = 'app' or m.score_status = 'confirmed')) as played
    from m
  ),
  pl as (
    select p.id, p.created_at, p.level from public.profiles p
    where v_city is null or p.city = v_city
  ),
  buckets as (
    select gs as start_local
    from generate_series(v_first, date_trunc(v_unit, v_now_local), v_step) gs
  ),
  series as (
    select
      b.start_local,
      (select count(*) from pl
        where (pl.created_at at time zone c_tz) >= b.start_local
          and (pl.created_at at time zone c_tz) < b.start_local + v_step) as signups,
      (select count(*) from mm
        where mm.kind = 'friendly' and (mm.created_at at time zone c_tz) >= b.start_local
          and (mm.created_at at time zone c_tz) < b.start_local + v_step) as friendly,
      (select count(*) from mm
        where mm.kind = 'competitive' and (mm.created_at at time zone c_tz) >= b.start_local
          and (mm.created_at at time zone c_tz) < b.start_local + v_step) as competitive,
      -- Fill rate: of the app matches that already started and weren't cancelled, how many
      -- had every seat taken
      (select count(*) from mm
        where mm.origin = 'app' and mm.status = 'open' and mm.starts_at <= v_now
          and (mm.starts_at at time zone c_tz) >= b.start_local
          and (mm.starts_at at time zone c_tz) < b.start_local + v_step) as started,
      (select count(*) from mm
        where mm.origin = 'app' and mm.status = 'open' and mm.starts_at <= v_now
          and mm.filled = mm.seats_total
          and (mm.starts_at at time zone c_tz) >= b.start_local
          and (mm.starts_at at time zone c_tz) < b.start_local + v_step) as filled
    from buckets b
  ),
  -- KPI windows: [now - 7 d, now) and the 7 days before it
  kpi as (
    select
      (select count(*) from pl where pl.created_at >= v_now - interval '7 days') as players_cur,
      (select count(*) from pl where pl.created_at >= v_now - interval '14 days'
         and pl.created_at < v_now - interval '7 days') as players_prev,
      (select count(*) from mm where mm.created_at >= v_now - interval '7 days') as created_cur,
      (select count(*) from mm where mm.created_at >= v_now - interval '14 days'
         and mm.created_at < v_now - interval '7 days') as created_prev,
      (select count(*) from mm where mm.played and mm.starts_at >= v_now - interval '7 days') as played_cur,
      (select count(*) from mm where mm.played and mm.starts_at >= v_now - interval '14 days'
         and mm.starts_at < v_now - interval '7 days') as played_prev,
      -- Confirmed-score rate: of the scores entered for matches that ended at least 48 hours
      -- ago (the confirmation window), how many were confirmed
      (select count(*) filter (where mm.score_status = 'confirmed') from mm
        where mm.score_status is not null and mm.ends_at <= v_now - interval '48 hours'
          and mm.ends_at > v_now - interval '9 days') as confirmed_cur,
      (select count(*) from mm
        where mm.score_status is not null and mm.ends_at <= v_now - interval '48 hours'
          and mm.ends_at > v_now - interval '9 days') as scored_cur,
      (select count(*) filter (where mm.score_status = 'confirmed') from mm
        where mm.score_status is not null and mm.ends_at <= v_now - interval '9 days'
          and mm.ends_at > v_now - interval '16 days') as confirmed_prev,
      (select count(*) from mm
        where mm.score_status is not null and mm.ends_at <= v_now - interval '9 days'
          and mm.ends_at > v_now - interval '16 days') as scored_prev
  ),
  heat as (
    -- Match start times of the last 30 days: weekday (1 = Monday) by 2-hour slot, 08:00 to 24:00
    select
      extract(isodow from (mm.starts_at at time zone c_tz))::integer as dow,
      ((extract(hour from (mm.starts_at at time zone c_tz))::integer - 8) / 2) as slot,
      count(*) as n
    from mm
    where mm.status = 'open' and mm.starts_at >= v_now - interval '30 days' and mm.starts_at <= v_now
      and extract(hour from (mm.starts_at at time zone c_tz)) >= 8
    group by 1, 2
  ),
  pending as (
    select s.match_id, s.expires_at, s.submitted_at
    from public.match_scores s
    where s.status = 'pending' and s.expires_at > v_now
  )
  select jsonb_build_object(
    'range', p_range,
    'city', v_city,
    'generated_at', v_now,
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        'start', to_char(s.start_local, 'YYYY-MM-DD'), 'signups', s.signups,
        'friendly', s.friendly, 'competitive', s.competitive,
        'started', s.started, 'filled', s.filled
      ) order by s.start_local) from series s
    ), '[]'::jsonb),
    'kpi', (select to_jsonb(k) from kpi k),
    'levels', jsonb_build_object(
      'total', (select count(*) from pl where pl.level is not null),
      'median', (select percentile_cont(0.5) within group (order by pl.level) from pl where pl.level is not null),
      -- Buckets of half a level, 1.0 to 7.0; a level of exactly 7 counts in the last one
      'buckets', coalesce((
        select jsonb_agg(jsonb_build_object('from', g.lo, 'count', (
          select count(*) from pl
          where pl.level >= g.lo and (pl.level < g.lo + 0.5 or (g.lo = 6.5 and pl.level <= 7.0))
        )) order by g.lo)
        from (select generate_series(1.0, 6.5, 0.5) as lo) g
      ), '[]'::jsonb)
    ),
    'heatmap', coalesce((
      select jsonb_agg(row_counts order by d) from (
        select d, jsonb_agg(coalesce((select h.n from heat h where h.dow = d and h.slot = sl), 0) order by sl) as row_counts
        from generate_series(1, 7) d, generate_series(0, 7) sl
        group by d
      ) rows_
    ), '[]'::jsonb),
    'attention', jsonb_build_object(
      'pending_scores', (select count(*) from pending where submitted_at < v_now - interval '24 hours'),
      'pending_scores_all', (select count(*) from pending),
      'expiring_12h', (select count(*) from pending where expires_at < v_now + interval '12 hours'),
      'expiring', coalesce((
        select jsonb_agg(jsonb_build_object(
          'match_id', e.match_id, 'expires_at', e.expires_at,
          'team1', e.team1, 'team2', e.team2
        ) order by e.expires_at)
        from (
          select pd.match_id, pd.expires_at,
            (select string_agg(p.first_name || ' ' || left(p.last_name, 1) || '.', ' + ' order by mp.seat)
               from public.match_players mp join public.profiles p on p.id = mp.player_id
              where mp.match_id = pd.match_id and mp.seat <= 2) as team1,
            (select string_agg(p.first_name || ' ' || left(p.last_name, 1) || '.', ' + ' order by mp.seat)
               from public.match_players mp join public.profiles p on p.id = mp.player_id
              where mp.match_id = pd.match_id and mp.seat > 2) as team2
          from pending pd order by pd.expires_at limit 3
        ) e
      ), '[]'::jsonb),
      'reports_7d', (select count(*) from public.player_reports where created_at >= v_now - interval '7 days'),
      'reports_today', (select count(*) from public.player_reports where created_at >= v_now - interval '24 hours'),
      'oldest_report_7d', (select min(created_at) from public.player_reports where created_at >= v_now - interval '7 days'),
      'open_seats_24h', (
        select count(*) from public.matches ma
        where ma.status = 'open' and ma.starts_at > v_now and ma.starts_at <= v_now + interval '24 hours'
          and (select count(*) from public.match_players mp where mp.match_id = ma.id) < ma.players_needed + 1
      ),
      'quiet_clubs', (
        select count(*) from public.clubs c
        where c.status = 'published' and not exists (
          select 1 from public.matches ma join public.courts ct on ct.id = ma.court_id
          where ct.club_id = c.id and ma.status = 'open' and ma.starts_at >= v_now - interval '30 days'
        )
      ),
      'draft_clubs', (select count(*) from public.clubs where status = 'draft')
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_overview_stats(text, text) from public, anon;
grant execute on function public.admin_overview_stats(text, text) to authenticated;
