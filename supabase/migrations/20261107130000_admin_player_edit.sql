-- Admin dashboard, Players phase 2a: correct a player's details and remove their photo.
-- Every write checks the admin role, needs a written reason, and records itself in admin_actions.

-- Edit a player. p_changes holds only the fields to change (first_name, last_name, city, bio,
-- phone, level, hand, side, play_style); anything missing stays as it is. A new level goes
-- through the normal triggers, so level_history gets a row with cause 'admin' and the exact
-- level_points under it resets (sync_level_points).
create function public.admin_update_player(
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
  v_level numeric;
begin
  perform public.assert_admin();

  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Write a reason of at least 3 characters';
  end if;

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
    level = coalesce(v_level, level)
  where id = p_id
  returning * into v_after;

  if (v_before.first_name, v_before.last_name, v_before.city, v_before.bio, v_before.phone,
      v_before.hand, v_before.side, v_before.play_style, v_before.level)
     is not distinct from
     (v_after.first_name, v_after.last_name, v_after.city, v_after.bio, v_after.phone,
      v_after.hand, v_after.side, v_after.play_style, v_after.level) then
    raise exception 'Nothing was changed';
  end if;

  perform public.log_admin_action(
    'update_player', 'player', p_id::text,
    jsonb_build_object(
      'first_name', v_before.first_name, 'last_name', v_before.last_name, 'city', v_before.city,
      'bio', v_before.bio, 'phone', v_before.phone, 'hand', v_before.hand, 'side', v_before.side,
      'play_style', v_before.play_style, 'level', v_before.level
    ),
    jsonb_build_object(
      'first_name', v_after.first_name, 'last_name', v_after.last_name, 'city', v_after.city,
      'bio', v_after.bio, 'phone', v_after.phone, 'hand', v_after.hand, 'side', v_after.side,
      'play_style', v_after.play_style, 'level', v_after.level
    ),
    btrim(p_reason)
  );
end;
$$;

revoke all on function public.admin_update_player(uuid, jsonb, text) from public, anon;
grant execute on function public.admin_update_player(uuid, jsonb, text) to authenticated;

-- Clears the player's photo and returns its path in the avatars bucket, so the dashboard can
-- delete the file (the same way admin_delete_club_photo works). avatar_url is the full public
-- URL the app saved, e.g. .../object/public/avatars/<user id>/avatar.jpeg?v=123.
create function public.admin_remove_player_photo(p_id uuid, p_reason text)
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

  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Write a reason of at least 3 characters';
  end if;

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

revoke all on function public.admin_remove_player_photo(uuid, text) from public, anon;
grant execute on function public.admin_remove_player_photo(uuid, text) to authenticated;

-- The dashboard deletes the file itself, as the signed-in admin
create policy "Admins delete avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (select public.is_admin()));
