-- Admin dashboard, Matches: the match detail drawer and Cancel match.

-- Everything the drawer shows, in one call. Returns null when the match doesn't exist.
-- Messages are the latest 100 (oldest first) with a total, system notes included.
-- Seats 1-2 are team 1 (the host's), seats 3-4 team 2.
create function public.admin_get_match(p_id uuid)
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
    'id', m.id,
    'starts_at', m.starts_at,
    'duration_minutes', m.duration_minutes,
    'kind', m.kind,
    'status', m.status,
    'origin', m.origin,
    'level_min', m.level_min,
    'level_max', m.level_max,
    'price', m.price,
    'note', m.note,
    'created_at', m.created_at,
    'seats_total', m.players_needed + 1,
    'host', jsonb_build_object(
      'id', h.id, 'name', h.first_name || ' ' || h.last_name,
      'avatar_url', h.avatar_url, 'level', h.level
    ),
    'club', case when c.id is null then null
      else jsonb_build_object('id', c.id, 'name', c.name, 'city', c.city) end,
    'court', case when ct.id is null then null
      else jsonb_build_object('id', ct.id, 'number', ct.number, 'indoor', ct.indoor) end,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', mp.seat, 'id', p.id, 'name', p.first_name || ' ' || p.last_name,
        'avatar_url', p.avatar_url, 'level', p.level, 'joined_at', mp.joined_at,
        'is_host', p.id = m.host_id
      ) order by mp.seat)
      from public.match_players mp
      join public.profiles p on p.id = mp.player_id
      where mp.match_id = m.id
    ), '[]'::jsonb),
    'messages_total', (select count(*) from public.match_messages where match_id = m.id),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'kind', x.kind, 'body', x.body, 'created_at', x.created_at,
        'sender_id', x.sender_id, 'sender_name', sp.first_name || ' ' || sp.last_name
      ) order by x.created_at)
      from (
        select * from public.match_messages
        where match_id = m.id order by created_at desc limit 100
      ) x
      left join public.profiles sp on sp.id = x.sender_id
    ), '[]'::jsonb),
    'score', (
      select jsonb_build_object(
        'status', case when s.status = 'pending' and s.expires_at <= now() then 'expired' else s.status end,
        'team1_games', s.team1_games, 'team2_games', s.team2_games,
        'submitted_team', s.submitted_team, 'submitted_at', s.submitted_at,
        'submitted_by', sb.first_name || ' ' || sb.last_name,
        'expires_at', s.expires_at, 'confirmed_at', s.confirmed_at,
        'confirmed_by', cb.first_name || ' ' || cb.last_name,
        'levels_settled', s.levels_settled_at is not null
      )
      from public.match_scores s
      left join public.profiles sb on sb.id = s.submitted_by
      left join public.profiles cb on cb.id = s.confirmed_by
      where s.match_id = m.id
    ),
    'score_events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event', e.event, 'created_at', e.created_at, 'team1_games', e.team1_games,
        'team2_games', e.team2_games, 'actor_name', ap.first_name || ' ' || ap.last_name
      ) order by e.created_at)
      from public.score_events e
      left join public.profiles ap on ap.id = e.actor_id
      where e.match_id = m.id
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
  join public.profiles h on h.id = m.host_id
  left join public.courts ct on ct.id = m.court_id
  left join public.clubs c on c.id = ct.club_id
  where m.id = p_id;

  return v_result;
end;
$$;

revoke all on function public.admin_get_match(uuid) from public, anon;
grant execute on function public.admin_get_match(uuid) to authenticated;

-- Cancels an upcoming match. The matches_note_chat trigger then writes the 'cancelled' chat
-- note and queues the match_cancelled push and notification for every other player in the
-- match, exactly as when the host cancels. The note shows the host as its author.
-- A match that has started can't be cancelled: past results are fixed from Scores.
create function public.admin_cancel_match(p_match_id uuid, p_reason text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
begin
  perform public.assert_admin();

  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Write a reason of at least 3 characters';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'This match no longer exists';
  end if;
  if v_match.status = 'cancelled' then
    raise exception 'This match is already cancelled';
  end if;
  if v_match.starts_at + make_interval(mins => v_match.duration_minutes) <= now() then
    raise exception 'A match that already happened can''t be cancelled. Fix its result from Scores instead';
  end if;

  update public.matches set status = 'cancelled' where id = p_match_id;

  perform public.log_admin_action(
    'cancel_match', 'match', p_match_id::text,
    jsonb_build_object('status', v_match.status),
    jsonb_build_object('status', 'cancelled'),
    btrim(p_reason)
  );
end;
$$;

revoke all on function public.admin_cancel_match(uuid, text) from public, anon;
grant execute on function public.admin_cancel_match(uuid, text) to authenticated;
