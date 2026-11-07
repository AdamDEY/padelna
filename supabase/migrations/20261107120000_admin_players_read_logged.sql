-- Follow-up to admin_players_read: count logged matches the way played_matches() does.

-- Everything on one player's page. Returns null when the player doesn't exist.
-- Ratings stay anonymous: counts only, never who gave them.
-- A match is 'played' when it is over with all four seats taken and, if it was logged afterwards,
-- its score is confirmed (same rule as played_matches()); 'awaiting_score' when only the
-- confirmation is missing; 'not_filled' when it is over without four players. Teams follow the seats: 1-2 are team 1 (the host's), 3-4 team 2.
create or replace function public.admin_get_player(p_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_profile jsonb;
  v_result jsonb;
begin
  perform public.assert_admin();

  select to_jsonb(p) || jsonb_build_object(
    'email', u.email,
    'last_sign_in_at', u.last_sign_in_at
  )
  into v_profile
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_id;

  if v_profile is null then
    return null;
  end if;

  with my_matches as (
    select
      m.id, m.starts_at, m.kind, m.status, m.origin, m.host_id, m.players_needed,
      mp.seat,
      case when mp.seat <= 2 then 1 else 2 end as team,
      (select count(*) from public.match_players x where x.match_id = m.id)::integer as seats_filled,
      c.name as club_name,
      ct.number as court_number,
      s.status as score_status,
      s.expires_at as score_expires_at,
      s.team1_games, s.team2_games
    from public.match_players mp
    join public.matches m on m.id = mp.match_id
    left join public.courts ct on ct.id = m.court_id
    left join public.clubs c on c.id = ct.club_id
    left join public.match_scores s on s.match_id = m.id
    where mp.player_id = p_id
  ),
  classified as (
    select
      mm.*,
      case
        when mm.status = 'cancelled' then 'cancelled'
        when mm.starts_at + interval '90 minutes' > now() then 'upcoming'
        when mm.seats_filled = mm.players_needed + 1
          and (mm.origin = 'app' or mm.score_status = 'confirmed') then 'played'
        -- A match logged afterwards counts only once the other team confirms the score,
        -- like played_matches()
        when mm.seats_filled = mm.players_needed + 1 then 'awaiting_score'
        else 'not_filled'
      end as state,
      -- Sets won by each team on a confirmed score; null until there is one
      case when mm.score_status = 'confirmed' then (
        select count(*) from generate_series(1, cardinality(mm.team1_games)) i
        where mm.team1_games[i] > mm.team2_games[i]
      ) end as team1_sets,
      case when mm.score_status = 'confirmed' then (
        select count(*) from generate_series(1, cardinality(mm.team1_games)) i
        where mm.team2_games[i] > mm.team1_games[i]
      ) end as team2_sets
    from my_matches mm
  ),
  with_result as (
    select
      cl.*,
      case
        when cl.team1_sets is null then null
        else (cl.team = 1) = (cl.team1_sets > cl.team2_sets)
      end as won
    from classified cl
  )
  select jsonb_build_object(
    'profile', v_profile,
    'stats', jsonb_build_object(
      'matches_played', (select count(*) from with_result where state = 'played'),
      'hosted', (select count(*) from with_result where host_id = p_id and state = 'played'),
      'joined', (select count(*) from with_result where host_id <> p_id and state = 'played'),
      'competitive', (select count(*) from with_result where kind = 'competitive' and state = 'played'),
      'friendly', (select count(*) from with_result where kind = 'friendly' and state = 'played'),
      'wins', (select count(*) from with_result where won),
      'losses', (select count(*) from with_result where won = false),
      -- Played, but no score was ever entered
      'no_score', (select count(*) from with_result where state = 'played' and score_status is null),
      'upcoming', (select count(*) from with_result where state = 'upcoming'),
      'cancelled', (select count(*) from with_result where state = 'cancelled')
    ),
    'level_history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'old_level', lh.old_level, 'new_level', lh.new_level, 'cause', lh.cause,
        'match_id', lh.match_id, 'created_at', lh.created_at
      ) order by lh.created_at)
      from public.level_history lh where lh.player_id = p_id
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'starts_at', r.starts_at, 'kind', r.kind, 'origin', r.origin,
        'state', r.state, 'role', case when r.host_id = p_id then 'host' else 'joined' end,
        'seat', r.seat, 'seats_filled', r.seats_filled, 'seats_total', r.players_needed + 1,
        'club_name', r.club_name, 'court_number', r.court_number,
        'score_status', case
          when r.score_status = 'pending' and r.score_expires_at <= now() then 'expired'
          else r.score_status
        end,
        'team1_games', r.team1_games, 'team2_games', r.team2_games,
        'team', r.team, 'won', r.won
      ) order by r.starts_at desc)
      from (select * from with_result order by starts_at desc limit 50) r
    ), '[]'::jsonb),
    'matches_total', (select count(*) from with_result),
    'ratings', jsonb_build_object(
      'total', (select count(*) from public.player_ratings where rated_id = p_id),
      'average', (select round(avg(rating)::numeric, 2) from public.player_ratings where rated_id = p_id),
      'counts', coalesce((
        select jsonb_object_agg(rating::text, n)
        from (
          select rating, count(*) as n from public.player_ratings
          where rated_id = p_id group by rating
        ) x
      ), '{}'::jsonb),
      'tags', coalesce((
        select jsonb_agg(jsonb_build_object('tag', tag, 'count', n) order by n desc, tag)
        from (
          select tag, count(*) as n from public.player_rating_tags
          where rated_id = p_id group by tag
        ) x
      ), '[]'::jsonb)
    ),
    'connections', jsonb_build_object(
      'accepted', (
        select count(*) from public.connections c
        where c.status = 'accepted' and p_id in (c.requester_id, c.addressee_id)
      ),
      'list', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', o.id, 'first_name', o.first_name, 'last_name', o.last_name
        ) order by o.first_name, o.last_name)
        from public.connections c
        join public.profiles o
          on o.id = case when c.requester_id = p_id then c.addressee_id else c.requester_id end
        where c.status = 'accepted' and p_id in (c.requester_id, c.addressee_id)
      ), '[]'::jsonb)
    ),
    'clubs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'club_id', g.club_id, 'club_name', g.club_name,
        'match_count', g.n, 'last_played_at', g.last_at
      ) order by g.n desc, g.last_at desc)
      from (
        select pm.club_id, pm.club_name, count(*) as n, max(pm.played_at) as last_at
        from public.played_matches() pm
        where pm.player_id = p_id and pm.club_id is not null
        group by pm.club_id, pm.club_name
      ) g
    ), '[]'::jsonb),
    'reports_about', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'reason', r.reason, 'comment', r.comment,
        'played_together', r.played_together, 'created_at', r.created_at,
        'reporter_id', r.reporter_id,
        'reporter_name', rp.first_name || ' ' || rp.last_name
      ) order by r.created_at desc)
      from public.player_reports r
      join public.profiles rp on rp.id = r.reporter_id
      where r.reported_id = p_id
    ), '[]'::jsonb),
    'reports_by', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'reason', r.reason, 'comment', r.comment,
        'played_together', r.played_together, 'created_at', r.created_at,
        'reported_id', r.reported_id,
        'reported_name', rp.first_name || ' ' || rp.last_name
      ) order by r.created_at desc)
      from public.player_reports r
      join public.profiles rp on rp.id = r.reported_id
      where r.reporter_id = p_id
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'action', a.action, 'reason', a.reason,
        'before', a.before, 'after', a.after, 'created_at', a.created_at
      ) order by a.created_at desc)
      from public.admin_actions a
      where a.target_type = 'player' and a.target_id = p_id::text
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_get_player(uuid) from public, anon;
grant execute on function public.admin_get_player(uuid) to authenticated;
