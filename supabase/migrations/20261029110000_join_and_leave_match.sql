-- Joining and leaving go through functions, so the rules are checked on the
-- server and two players can't take the same seat. match_players has no
-- insert or delete policy on purpose.
--
-- Seat layout: the host takes seat 1 and the guests they bring take the next
-- seats; the last players_needed seats are open to other players.

create function public.join_match(p_match_id uuid, p_seat smallint)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_level numeric;
  -- A match within this distance of its range still counts as a good fit, as in the app
  c_level_margin constant numeric := 0.5;
begin
  if v_uid is null then
    raise exception 'Sign in to join a match';
  end if;

  -- Lock the match so two joins at once are handled one after the other
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'This match no longer exists';
  end if;
  if v_match.status <> 'open' then
    raise exception 'This match was cancelled';
  end if;
  if v_match.starts_at <= now() then
    raise exception 'This match has already started';
  end if;

  if p_seat is null or p_seat < 1 or p_seat > 4 or p_seat <= 4 - v_match.players_needed then
    raise exception 'That spot isn''t open';
  end if;
  if exists (
    select 1 from public.match_players where match_id = p_match_id and player_id = v_uid
  ) then
    raise exception 'You''re already in this match';
  end if;
  if exists (
    select 1 from public.match_players where match_id = p_match_id and seat = p_seat
  ) then
    raise exception 'Someone just took that spot';
  end if;

  select level into v_level from public.profiles where id = v_uid;
  if v_level is not null
     and (v_level < v_match.level_min - c_level_margin or v_level > v_match.level_max + c_level_margin) then
    raise exception 'Your level is outside this match''s range';
  end if;

  if exists (
    select 1
    from public.match_players mp
    join public.matches other on other.id = mp.match_id
    where mp.player_id = v_uid
      and other.status = 'open'
      and other.id <> p_match_id
      and other.starts_at < v_match.starts_at + interval '90 minutes'
      and v_match.starts_at < other.starts_at + interval '90 minutes'
  ) then
    raise exception 'You already have a match at that time';
  end if;

  insert into public.match_players (match_id, seat, player_id)
  values (p_match_id, p_seat, v_uid);
end;
$$;

create function public.leave_match(p_match_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'This match no longer exists';
  end if;
  if v_match.host_id = v_uid then
    raise exception 'You''re hosting this match. Cancel it instead.';
  end if;
  if v_match.starts_at <= now() then
    raise exception 'This match has already started';
  end if;

  delete from public.match_players where match_id = p_match_id and player_id = v_uid;
  if not found then
    raise exception 'You''re not in this match';
  end if;
end;
$$;

revoke all on function public.join_match(uuid, smallint) from public, anon;
revoke all on function public.leave_match(uuid) from public, anon;
grant execute on function public.join_match(uuid, smallint) to authenticated;
grant execute on function public.leave_match(uuid) to authenticated;
