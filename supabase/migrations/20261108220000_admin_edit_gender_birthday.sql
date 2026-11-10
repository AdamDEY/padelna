-- The admin can correct a player's gender and birth date. p_changes now also takes 'gender'
-- ('male', 'female', or '' to clear it) and 'birth_date' ('YYYY-MM-DD', or '' to clear it).
-- Anything missing from p_changes stays as it is, and both fields are in the audit log.

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

  -- Gender and birth date can be cleared, so they follow "was it in p_changes", not "is it null"
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
