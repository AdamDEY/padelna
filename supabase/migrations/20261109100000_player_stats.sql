-- Real numbers for the Profile: results, streak, level over the last 6 months, win rate by
-- opponent level and by set, and best partners. Everything comes from matches with a confirmed
-- score that the player was in (friendly and competitive both count). The app only shows them
-- once `matches_scored` reaches 5.
--
-- `player_stats` takes the player so it can be tested; only `get_my_stats` is callable.
create function public.player_stats(p_player_id uuid)
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with me as (
    select level from public.profiles where id = p_player_id
  ),
  scored as (
    select s.match_id, m.starts_at, s.team1_games g1, s.team2_games g2,
           case when mp.seat <= 2 then 1 else 2 end as my_team
    from public.match_scores s
    join public.matches m on m.id = s.match_id
    join public.match_players mp on mp.match_id = s.match_id and mp.player_id = p_player_id
    where s.status = 'confirmed' and m.status = 'open'
  ),
  sets as (
    -- One row per set, from the player's side
    select sc.match_id, n,
           case when sc.my_team = 1 then sc.g1[n] else sc.g2[n] end as mine,
           case when sc.my_team = 1 then sc.g2[n] else sc.g1[n] end as theirs
    from scored sc, lateral generate_series(1, coalesce(array_length(sc.g1, 1), 0)) as n
  ),
  results as (
    select sc.match_id, sc.starts_at, sc.my_team,
           (select count(*) filter (where st.mine > st.theirs) > count(*) filter (where st.mine < st.theirs)
            from sets st where st.match_id = sc.match_id) as won,
           (select st.mine > st.theirs from sets st where st.match_id = sc.match_id and st.n = 1) as won_first,
           (select st.mine > st.theirs from sets st where st.match_id = sc.match_id and st.n = 3) as won_third,
           (select avg(p.level) from public.match_players o
            join public.profiles p on p.id = o.player_id
            where o.match_id = sc.match_id and (case when o.seat <= 2 then 1 else 2 end) <> sc.my_team) as opp_level
    from scored sc
  ),
  ordered as (
    select won, row_number() over (order by starts_at desc) as rn from results
  ),
  streak as (
    select (select won from ordered where rn = 1) as won,
           (select count(*) from ordered
            where rn < coalesce((select min(rn) from ordered o2 where o2.won <> (select won from ordered where rn = 1)), 1000000)) as run
  ),
  buckets as (
    -- Opponents' average level against yours, using today's levels; within 0.25 is "same"
    select r.won,
           case when r.opp_level < me.level - 0.25 then 'lower'
                when r.opp_level > me.level + 0.25 then 'higher'
                else 'same' end as bucket
    from results r, me
    where r.opp_level is not null
  ),
  partners as (
    select p.id, p.first_name, p.last_name, p.city, p.level, p.avatar_url,
           count(*) as matches, count(*) filter (where r.won) as wins
    from results r
    join public.match_players mp on mp.match_id = r.match_id
      and (case when mp.seat <= 2 then 1 else 2 end) = r.my_team and mp.player_id <> p_player_id
    join public.profiles p on p.id = mp.player_id
    group by p.id
    having count(*) >= 2
    order by count(*) filter (where r.won)::numeric / count(*) desc, count(*) desc, p.first_name
    limit 3
  ),
  months as (
    select m as month_start, least(m + interval '1 month', now()) as month_end
    from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') as m
  ),
  level_by_month as (
    select extract(month from mo.month_start)::int as month,
           coalesce(
             (select lh.new_level from public.level_history lh
              where lh.player_id = p_player_id and lh.created_at <= mo.month_end
              order by lh.created_at desc limit 1),
             (select coalesce(lh.old_level, lh.new_level) from public.level_history lh
              where lh.player_id = p_player_id order by lh.created_at limit 1),
             (select level from me)
           ) as level,
           mo.month_start
    from months mo
  )
  select jsonb_build_object(
    'matches_played', (select count(distinct pm.match_id) from public.played_matches() pm where pm.player_id = p_player_id),
    'matches_scored', (select count(*) from results),
    'wins', (select count(*) from results where won),
    'streak_won', (select won from streak),
    'streak_run', (select run from streak),
    'won_first_set', (select count(*) from results where won_first),
    'third_sets', (select count(*) from results where won_third is not null),
    'won_third_set', (select count(*) from results where won_third),
    'opponents', (select coalesce(jsonb_object_agg(bucket, jsonb_build_object('matches', n, 'wins', w)), '{}'::jsonb)
                  from (select bucket, count(*) n, count(*) filter (where won) w from buckets group by bucket) b),
    'partners', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', id, 'first_name', first_name, 'last_name', last_name, 'city', city,
                    'level', level, 'avatar_url', avatar_url, 'matches', matches, 'wins', wins)), '[]'::jsonb)
                 from partners),
    'level_history', (select jsonb_agg(jsonb_build_object('month', month, 'level', level) order by month_start)
                      from level_by_month)
  );
$$;

revoke all on function public.player_stats(uuid) from public, anon, authenticated;

create function public.get_my_stats()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select public.player_stats((select auth.uid()));
$$;

revoke all on function public.get_my_stats() from public, anon;
grant execute on function public.get_my_stats() to authenticated;
