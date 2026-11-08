-- Admin dashboard, Scores: read-only. The queue, its counters and one score's timeline.
-- Admin actions on scores (set, reopen, void) come in a later migration.
--
-- How scores work, for reference: the host saves a score, and a player from the other team
-- confirms it or sends a different one (a "correction", which then waits for the host's team).
-- A score nobody confirms within 48 hours expires and never counts; it is not auto-confirmed.

-- One row per score or score-less played match, with the status the queue needs:
--   pending   waiting for the other team, before expires_at
--   expired   still pending past expires_at (never counts)
--   confirmed
--   none      a played match (all seats taken, app-made, over for 24 h or more) with no score
-- 'disputed' is a pending score that was corrected at least once.
create function public.admin_scores_base()
  returns table (
    match_id uuid,
    starts_at timestamptz,
    ends_at timestamptz,
    kind text,
    club_name text,
    court_number integer,
    team1 text,
    team2 text,
    team1_games smallint[],
    team2_games smallint[],
    status text,
    disputed boolean,
    submitted_team smallint,
    submitted_by text,
    submitted_at timestamptz,
    expires_at timestamptz,
    confirmed_at timestamptz
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select
    m.id,
    m.starts_at,
    m.starts_at + make_interval(mins => m.duration_minutes),
    m.kind,
    c.name,
    ct.number::integer,
    (select string_agg(p.first_name || ' ' || left(p.last_name, 1) || '.', ' + ' order by mp.seat)
       from public.match_players mp join public.profiles p on p.id = mp.player_id
      where mp.match_id = m.id and mp.seat <= 2),
    (select string_agg(p.first_name || ' ' || left(p.last_name, 1) || '.', ' + ' order by mp.seat)
       from public.match_players mp join public.profiles p on p.id = mp.player_id
      where mp.match_id = m.id and mp.seat > 2),
    s.team1_games,
    s.team2_games,
    case
      when s.match_id is null then 'none'
      when s.status = 'confirmed' then 'confirmed'
      when s.expires_at <= now() then 'expired'
      else 'pending'
    end,
    s.match_id is not null and s.status = 'pending' and s.expires_at > now()
      and exists (select 1 from public.score_events e where e.match_id = m.id and e.event = 'correct'),
    s.submitted_team,
    sb.first_name || ' ' || sb.last_name,
    s.submitted_at,
    s.expires_at,
    s.confirmed_at
  from public.matches m
  left join public.match_scores s on s.match_id = m.id
  left join public.profiles sb on sb.id = s.submitted_by
  left join public.courts ct on ct.id = m.court_id
  left join public.clubs c on c.id = ct.club_id
  where m.status = 'open'
    and (
      s.match_id is not null
      or (
        m.origin = 'app'
        and m.starts_at + make_interval(mins => m.duration_minutes) <= now() - interval '24 hours'
        and (select count(*) from public.match_players mp where mp.match_id = m.id) = m.players_needed + 1
      )
    );
$$;

revoke all on function public.admin_scores_base() from public, anon, authenticated;

-- The numbers above the queue and on its tabs
create function public.admin_scores_overview()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  perform public.assert_admin();

  return (
    select jsonb_build_object(
      'waiting', count(*) filter (where status = 'pending'),
      'expiring', count(*) filter (where status = 'pending' and expires_at < v_now + interval '12 hours'),
      'disputes', count(*) filter (where disputed),
      'oldest_dispute', min(submitted_at) filter (where disputed),
      'no_score', count(*) filter (where status = 'none'),
      'resolved', count(*) filter (where status in ('confirmed', 'expired')),
      'expired_week', count(*) filter (where status = 'expired' and expires_at >= v_now - interval '7 days'),
      'median_confirm_seconds', (
        select extract(epoch from percentile_cont(0.5) within group (order by confirmed_at - submitted_at))
        from public.admin_scores_base() x
        where x.status = 'confirmed' and x.confirmed_at >= v_now - interval '30 days'
      ),
      'median_confirm_seconds_before', (
        select extract(epoch from percentile_cont(0.5) within group (order by confirmed_at - submitted_at))
        from public.admin_scores_base() x
        where x.status = 'confirmed' and x.confirmed_at >= v_now - interval '60 days'
          and x.confirmed_at < v_now - interval '30 days'
      )
    )
    from public.admin_scores_base()
  );
end;
$$;

revoke all on function public.admin_scores_overview() from public, anon;
grant execute on function public.admin_scores_overview() to authenticated;

-- The queue. p_tab: waiting, expiring, disputes, no_score or resolved. Search matches the start
-- of the match id, a player's name or the club's name. p_sort: expires (soonest first, for the
-- open tabs) or newest.
create function public.admin_list_scores(
  p_tab text default 'waiting',
  p_search text default null,
  p_sort text default 'expires',
  p_limit integer default 50
)
  returns table (
    match_id uuid, starts_at timestamptz, club_name text, court_number integer, kind text,
    team1 text, team2 text, team1_games smallint[], team2_games smallint[],
    status text, disputed boolean, submitted_team smallint, submitted_by text,
    submitted_at timestamptz, expires_at timestamptz, confirmed_at timestamptz
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_search text := public.admin_search_text(btrim(coalesce(p_search, '')));
begin
  perform public.assert_admin();

  if p_tab not in ('waiting', 'expiring', 'disputes', 'no_score', 'resolved') then
    raise exception 'Unknown queue: %', p_tab;
  end if;
  if p_sort not in ('expires', 'newest') then
    raise exception 'Unknown sort: %', p_sort;
  end if;
  if p_limit < 1 or p_limit > 200 then
    raise exception 'Page size must be 1 to 200';
  end if;

  return query
  select
    b.match_id, b.starts_at, b.club_name, b.court_number, b.kind, b.team1, b.team2,
    b.team1_games, b.team2_games, b.status, b.disputed, b.submitted_team, b.submitted_by,
    b.submitted_at, b.expires_at, b.confirmed_at
  from public.admin_scores_base() b
  where (
      (p_tab = 'waiting' and b.status = 'pending')
      or (p_tab = 'expiring' and b.status = 'pending' and b.expires_at < now() + interval '12 hours')
      or (p_tab = 'disputes' and b.disputed)
      or (p_tab = 'no_score' and b.status = 'none')
      or (p_tab = 'resolved' and b.status in ('confirmed', 'expired'))
    )
    and (
      v_search = ''
      or b.match_id::text like v_search || '%'
      or public.admin_search_text(coalesce(b.team1, '') || ' ' || coalesce(b.team2, '') || ' ' || coalesce(b.club_name, ''))
         like '%' || v_search || '%'
    )
  order by
    case when p_sort = 'expires' and p_tab in ('waiting', 'expiring') then b.expires_at end asc,
    case when p_sort = 'expires' and p_tab = 'disputes' then b.expires_at end asc,
    b.starts_at desc
  limit p_limit;
end;
$$;

revoke all on function public.admin_list_scores(text, text, text, integer) from public, anon;
grant execute on function public.admin_list_scores(text, text, text, integer) to authenticated;

-- One score with its timeline. Returns null for an unknown match. Seats 1-2 are team 1 (A, the
-- host's), 3-4 team 2 (B).
create function public.admin_get_score(p_match_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.assert_admin();

  select jsonb_build_object(
    'match_id', m.id,
    'starts_at', m.starts_at,
    'ends_at', m.starts_at + make_interval(mins => m.duration_minutes),
    'kind', m.kind,
    'level_min', m.level_min,
    'level_max', m.level_max,
    'origin', m.origin,
    'match_status', m.status,
    'club_name', c.name,
    'court_number', ct.number,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', mp.seat, 'team', case when mp.seat <= 2 then 1 else 2 end,
        'id', p.id, 'name', p.first_name || ' ' || p.last_name,
        'avatar_url', p.avatar_url, 'level', p.level
      ) order by mp.seat)
      from public.match_players mp join public.profiles p on p.id = mp.player_id
      where mp.match_id = m.id
    ), '[]'::jsonb),
    'score', (
      select jsonb_build_object(
        'status', case
          when s.status = 'confirmed' then 'confirmed'
          when s.expires_at <= now() then 'expired'
          else 'pending' end,
        'team1_games', s.team1_games, 'team2_games', s.team2_games,
        'submitted_team', s.submitted_team, 'submitted_at', s.submitted_at,
        'submitted_by', sb.first_name || ' ' || sb.last_name,
        'expires_at', s.expires_at, 'confirmed_at', s.confirmed_at,
        'confirmed_by', cb.first_name || ' ' || cb.last_name,
        'levels_settled', s.levels_settled_at is not null,
        'disputed', s.status = 'pending' and s.expires_at > now()
          and exists (select 1 from public.score_events e where e.match_id = m.id and e.event = 'correct')
      )
      from public.match_scores s
      left join public.profiles sb on sb.id = s.submitted_by
      left join public.profiles cb on cb.id = s.confirmed_by
      where s.match_id = m.id
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event', e.event, 'created_at', e.created_at,
        'team1_games', e.team1_games, 'team2_games', e.team2_games,
        'submitted_team', e.submitted_team,
        'actor_name', ap.first_name || ' ' || ap.last_name
      ) order by e.created_at)
      from public.score_events e
      left join public.profiles ap on ap.id = e.actor_id
      where e.match_id = m.id
    ), '[]'::jsonb),
    'level_changes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id', lc.player_id, 'name', lp.first_name || ' ' || lp.last_name,
        'old_points', lc.old_points, 'new_points', lc.new_points
      ))
      from public.match_level_changes lc join public.profiles lp on lp.id = lc.player_id
      where lc.match_id = m.id
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'action', a.action, 'reason', a.reason, 'created_at', a.created_at
      ) order by a.created_at desc)
      from public.admin_actions a
      where a.target_type = 'match' and a.target_id = m.id::text
    ), '[]'::jsonb)
  )
  into v_result
  from public.matches m
  left join public.courts ct on ct.id = m.court_id
  left join public.clubs c on c.id = ct.club_id
  where m.id = p_match_id;

  return v_result;
end;
$$;

revoke all on function public.admin_get_score(uuid) from public, anon;
grant execute on function public.admin_get_score(uuid) to authenticated;
