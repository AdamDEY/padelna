-- Smaller fixes from testing the tournament join flow:
--
-- 1. Players can turn tournament pushes off on their own, with a new setting. The in-app list
--    still gets everything, like every other kind.
-- 2. An invite's notification goes away once it can't be answered any more (answered, cancelled
--    or expired), so the list doesn't keep asking for an answer.
-- 3. A level range keeps one decimal: 3.75 is refused rather than quietly saved as 3.8.

alter table public.notification_settings
  add column tournaments boolean not null default true;

grant insert (tournaments), update (tournaments) on public.notification_settings to authenticated;

create or replace function public.queue_push(
  p_player_id uuid,
  p_kind text,
  p_params jsonb,
  p_url text,
  p_match_id uuid default null,
  p_actor_id uuid default null
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_settings public.notification_settings%rowtype;
  v_wants boolean;
begin
  -- The in-app list gets everything, whatever the push settings say
  if p_kind <> 'chat_message' then
    insert into public.notifications (player_id, kind, actor_id, match_id, params, url)
    values (p_player_id, p_kind, p_actor_id, p_match_id, p_params, p_url);
  end if;

  select * into v_settings from public.notification_settings where player_id = p_player_id;
  v_wants := case
    when not found then true
    when p_kind = 'chat_message' then v_settings.chat
    when p_kind in (
      'player_joined', 'match_full', 'player_left', 'court_booked', 'court_changed',
      'court_unbooked', 'match_cancelled'
    ) then v_settings.match_updates
    when p_kind in ('score_to_confirm', 'rate_players', 'match_logged') then v_settings.scores
    when p_kind in ('connection_request', 'connection_accepted') then v_settings.connections
    when p_kind like 'tournament\_%' then v_settings.tournaments
    else true
  end;
  if not v_wants or not exists (select 1 from public.push_tokens where player_id = p_player_id) then
    return;
  end if;

  insert into public.notification_outbox (player_id, kind, params, url, match_id)
  values (p_player_id, p_kind, p_params, p_url, p_match_id);
end;
$$;

-- ---------------------------------------------------------------------------------------------

create function public.tournament_clear_invite(p_player_id uuid, p_tournament_id uuid)
  returns void
  language sql
  set search_path = ''
as $$
  delete from public.notifications
  where player_id = p_player_id
    and kind = 'tournament_invite'
    and url = '/tournament/' || p_tournament_id;
$$;

revoke all on function public.tournament_clear_invite(uuid, uuid) from public, anon, authenticated;

create or replace function public.tournament_refresh(p_tournament_id uuid)
  returns void
  language plpgsql
  set search_path = ''
as $$
declare
  v_capacity integer;
  v_entry public.tournament_entries%rowtype;
  v_expired record;
begin
  for v_expired in
    delete from public.tournament_entries
    where tournament_id = p_tournament_id
      and status in ('invited', 'waitlist_invited')
      and invite_expires_at <= now()
    returning player1_id, player2_id
  loop
    perform public.tournament_clear_invite(v_expired.player2_id, p_tournament_id);
    perform public.tournament_notify(
      v_expired.player1_id, 'tournament_invite_expired', p_tournament_id, v_expired.player2_id
    );
  end loop;

  select capacity into v_capacity from public.tournaments where id = p_tournament_id;
  if v_capacity is null then
    return;
  end if;

  while public.tournament_spots_taken(p_tournament_id) < v_capacity loop
    select * into v_entry
    from public.tournament_entries
    where tournament_id = p_tournament_id and status = 'waitlist'
    order by created_at
    limit 1;
    exit when not found;

    update public.tournament_entries set status = 'confirmed' where id = v_entry.id;
    perform public.tournament_notify(v_entry.player1_id, 'tournament_promoted', p_tournament_id);
    perform public.tournament_notify(v_entry.player2_id, 'tournament_promoted', p_tournament_id);
  end loop;
end;
$$;

create or replace function public.respond_to_tournament_invite(p_entry_id uuid, p_accept boolean)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_tournament uuid;
  v_entry public.tournament_entries%rowtype;
  v_status text;
begin
  select tournament_id into v_tournament from public.tournament_entries where id = p_entry_id;
  if not found then
    raise exception 'This invitation is no longer valid';
  end if;
  perform 1 from public.tournaments where id = v_tournament for update;
  perform public.assert_tournament_setup(v_tournament);

  select * into v_entry from public.tournament_entries where id = p_entry_id;
  if v_entry.player2_id is distinct from v_me
    or v_entry.status not in ('invited', 'waitlist_invited')
    or v_entry.invite_expires_at <= now() then
    raise exception 'This invitation is no longer valid';
  end if;

  perform public.tournament_clear_invite(v_me, v_tournament);

  if not p_accept then
    delete from public.tournament_entries where id = p_entry_id;
    perform public.tournament_notify(v_entry.player1_id, 'tournament_invite_declined', v_tournament, v_me);
    perform public.tournament_refresh(v_tournament);
    return null;
  end if;

  delete from public.tournament_entries
  where tournament_id = v_tournament and player1_id = v_me and status = 'looking';

  v_status := case when v_entry.status = 'invited' then 'confirmed' else 'waitlist' end;
  update public.tournament_entries
  set status = v_status, invite_expires_at = null
  where id = p_entry_id;

  perform public.tournament_notify(v_entry.player1_id, 'tournament_invite_accepted', v_tournament, v_me);
  perform public.tournament_refresh(v_tournament);
  return (select status from public.tournament_entries where id = p_entry_id);
end;
$$;

create or replace function public.leave_tournament(p_tournament_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_entry public.tournament_entries%rowtype;
  v_partner uuid;
  v_is_invite boolean;
begin
  perform 1 from public.tournaments where id = p_tournament_id for update;
  perform public.assert_tournament_setup(p_tournament_id);
  perform public.tournament_refresh(p_tournament_id);

  select * into v_entry from public.tournament_entries
  where tournament_id = p_tournament_id and (player1_id = v_me or player2_id = v_me)
  order by status = 'looking' desc, created_at
  limit 1;
  if not found then
    raise exception 'You are not in this tournament';
  end if;

  delete from public.tournament_entries where id = v_entry.id;

  v_is_invite := v_entry.status in ('invited', 'waitlist_invited');
  if v_is_invite then
    perform public.tournament_clear_invite(v_entry.player2_id, p_tournament_id);
  end if;

  v_partner := case when v_entry.player1_id = v_me then v_entry.player2_id else v_entry.player1_id end;
  perform public.tournament_notify(
    v_partner,
    case
      when v_is_invite and v_entry.player1_id = v_me then 'tournament_invite_cancelled'
      when v_is_invite then 'tournament_invite_declined'
      else 'tournament_partner_left'
    end,
    p_tournament_id,
    v_me
  );
  perform public.tournament_refresh(p_tournament_id);
end;
$$;

-- ---------------------------------------------------------------------------------------------

-- numeric(2,1) rounded on save before any check could see the real value
alter table public.tournaments
  alter column level_min type numeric(3, 2),
  alter column level_max type numeric(3, 2),
  add constraint tournaments_level_min_one_decimal check (level_min * 10 = trunc(level_min * 10)),
  add constraint tournaments_level_max_one_decimal check (level_max * 10 = trunc(level_max * 10));
