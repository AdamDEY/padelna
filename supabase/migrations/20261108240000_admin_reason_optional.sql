-- The written reason is optional for every admin action. There is one admin, so changes save
-- directly. A reason can still be sent: log_admin_action stores it when given and stores nothing
-- (null) when it is empty. Only the "reason required" checks are removed; everything else in
-- these functions is unchanged.

create or replace function public.admin_cancel_match(p_match_id uuid, p_reason text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
begin
  perform public.assert_admin();

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

create or replace function public.admin_delete_club(p_id text, p_reason text)
  returns text[]
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_before public.clubs%rowtype;
  v_paths text[];
begin
  perform public.assert_admin();

  select * into v_before from public.clubs where id = p_id for update;
  if not found then
    raise exception 'This club no longer exists';
  end if;
  if public.club_has_matches(p_id) then
    raise exception 'This club has matches, so it can''t be deleted. Close it permanently instead.';
  end if;

  v_paths := array(select file_path from public.club_photos where club_id = p_id);
  delete from public.clubs where id = p_id;

  perform public.log_admin_action('delete_club', 'club', p_id, to_jsonb(v_before), null, p_reason);
  return v_paths;
end;
$$;

create or replace function public.admin_delete_tournament(p_id uuid, p_reason text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
begin
  perform public.assert_admin();

  select * into v_tournament from public.tournaments where id = p_id for update;
  if not found then
    raise exception 'This tournament no longer exists';
  end if;

  delete from public.tournaments where id = p_id;

  perform public.log_admin_action(
    'delete_tournament', 'tournament', p_id::text,
    jsonb_build_object('name', v_tournament.name, 'format', v_tournament.format),
    null, btrim(p_reason)
  );
end;
$$;

create or replace function public.admin_remove_player_photo(p_id uuid, p_reason text)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_url text;
  v_path text;
begin
  perform public.assert_admin();

  select avatar_url into v_url from public.profiles where id = p_id for update;
  if not found then
    raise exception 'This player no longer exists';
  end if;
  if v_url is null then
    raise exception 'This player has no photo';
  end if;

  v_path := split_part(substring(v_url from '/avatars/(.*)$'), '?', 1);
  if v_path = '' or v_path is null then
    v_path := null;
  end if;

  update public.profiles set avatar_url = null where id = p_id;

  perform public.log_admin_action(
    'remove_player_photo', 'player', p_id::text,
    jsonb_build_object('avatar_url', v_url),
    jsonb_build_object('avatar_url', null),
    btrim(p_reason)
  );

  return v_path;
end;
$$;

create or replace function public.admin_set_club_status(p_id text, p_status text, p_closed_note text, p_reason text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_before public.clubs%rowtype;
  v_after public.clubs%rowtype;
begin
  perform public.assert_admin();

  if p_status = 'temporarily_closed' and char_length(btrim(coalesce(p_closed_note, ''))) = 0 then
    raise exception 'Add the note players will see';
  end if;

  select * into v_before from public.clubs where id = p_id for update;
  if not found then
    raise exception 'This club no longer exists';
  end if;
  -- Players would lose the club of a match they can still see
  if p_status = 'draft' and public.club_has_matches(p_id) then
    raise exception 'This club has matches, so it can''t go back to draft';
  end if;

  update public.clubs set
    status = p_status,
    closed_note = case when p_status = 'temporarily_closed' then btrim(p_closed_note) end
  where id = p_id
  returning * into v_after;

  perform public.log_admin_action(
    'set_club_status', 'club', p_id, to_jsonb(v_before), to_jsonb(v_after), p_reason
  );
end;
$$;

create or replace function public.admin_update_player(
  p_id uuid,
  p_changes jsonb,
  p_reason text
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_before public.profiles%rowtype;
  v_after public.profiles%rowtype;
  v_first text := case when p_changes ? 'first_name' then btrim(p_changes ->> 'first_name') end;
  v_last text := case when p_changes ? 'last_name' then btrim(p_changes ->> 'last_name') end;
  v_city text := case when p_changes ? 'city' then btrim(p_changes ->> 'city') end;
  v_bio text := case when p_changes ? 'bio' then btrim(p_changes ->> 'bio') end;
  v_phone text := case when p_changes ? 'phone' then btrim(p_changes ->> 'phone') end;
  v_hand text := case when p_changes ? 'hand' then p_changes ->> 'hand' end;
  v_side text := case when p_changes ? 'side' then p_changes ->> 'side' end;
  v_style text := case when p_changes ? 'play_style' then p_changes ->> 'play_style' end;
  v_gender text := case when p_changes ? 'gender' then nullif(btrim(p_changes ->> 'gender'), '') end;
  v_birth_text text := case when p_changes ? 'birth_date' then nullif(btrim(p_changes ->> 'birth_date'), '') end;
  v_birth date;
  v_level numeric;
begin
  perform public.assert_admin();

  if v_first is not null and v_first = '' then
    raise exception 'The first name can''t be empty';
  end if;
  if v_last is not null and v_last = '' then
    raise exception 'The last name can''t be empty';
  end if;
  if v_city is not null and v_city = '' then
    raise exception 'The city can''t be empty';
  end if;
  if v_bio is not null and char_length(v_bio) > 150 then
    raise exception 'The bio can be up to 150 characters';
  end if;
  if v_phone is not null and v_phone !~ '^[0-9]{8}$' then
    raise exception 'The phone needs the 8 digits after +216';
  end if;
  if v_hand is not null and v_hand not in ('right', 'left') then
    raise exception 'Hand must be right or left';
  end if;
  if v_side is not null and v_side not in ('left', 'right', 'both') then
    raise exception 'Court side must be left, right or both';
  end if;
  if v_style is not null and v_style not in ('aggressive', 'balanced', 'defensive', 'tactical') then
    raise exception 'Unknown play style';
  end if;
  if v_gender is not null and v_gender not in ('male', 'female') then
    raise exception 'Gender must be male or female';
  end if;

  if v_birth_text is not null then
    begin
      v_birth := v_birth_text::date;
    exception when others then
      raise exception 'The birth date isn''t a valid date';
    end;
    if v_birth > current_date or v_birth < date '1900-01-01' then
      raise exception 'The birth date must be between 1900 and today';
    end if;
  end if;

  if p_changes ? 'level' then
    begin
      v_level := (p_changes ->> 'level')::numeric;
    exception when others then
      raise exception 'The level must be a number from 1.0 to 7.0';
    end;
    if v_level is null or v_level < 1 or v_level > 7 or v_level <> round(v_level, 1) then
      raise exception 'The level must be from 1.0 to 7.0, in steps of 0.1';
    end if;
  end if;

  select * into v_before from public.profiles where id = p_id for update;
  if not found then
    raise exception 'This player no longer exists';
  end if;

  update public.profiles set
    first_name = coalesce(v_first, first_name),
    last_name = coalesce(v_last, last_name),
    city = coalesce(v_city, city),
    bio = coalesce(v_bio, bio),
    phone = coalesce(v_phone, phone),
    hand = coalesce(v_hand, hand),
    side = coalesce(v_side, side),
    play_style = coalesce(v_style, play_style),
    level = coalesce(v_level, level),
    gender = case when p_changes ? 'gender' then v_gender else gender end,
    birth_date = case when p_changes ? 'birth_date' then v_birth else birth_date end
  where id = p_id
  returning * into v_after;

  if (v_before.first_name, v_before.last_name, v_before.city, v_before.bio, v_before.phone,
      v_before.hand, v_before.side, v_before.play_style, v_before.level,
      v_before.gender, v_before.birth_date)
     is not distinct from
     (v_after.first_name, v_after.last_name, v_after.city, v_after.bio, v_after.phone,
      v_after.hand, v_after.side, v_after.play_style, v_after.level,
      v_after.gender, v_after.birth_date) then
    raise exception 'Nothing was changed';
  end if;

  perform public.log_admin_action(
    'update_player', 'player', p_id::text,
    jsonb_build_object(
      'first_name', v_before.first_name, 'last_name', v_before.last_name, 'city', v_before.city,
      'bio', v_before.bio, 'phone', v_before.phone, 'hand', v_before.hand, 'side', v_before.side,
      'play_style', v_before.play_style, 'level', v_before.level,
      'gender', v_before.gender, 'birth_date', v_before.birth_date
    ),
    jsonb_build_object(
      'first_name', v_after.first_name, 'last_name', v_after.last_name, 'city', v_after.city,
      'bio', v_after.bio, 'phone', v_after.phone, 'hand', v_after.hand, 'side', v_after.side,
      'play_style', v_after.play_style, 'level', v_after.level,
      'gender', v_after.gender, 'birth_date', v_after.birth_date
    ),
    btrim(p_reason)
  );
end;
$$;
