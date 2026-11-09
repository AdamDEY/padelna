-- Who a match is for: men, women or everyone (mixed). Men and women matches are limited to
-- players of that gender, checked when joining and when the host sets it. Matches that
-- existed before this change stay mixed.

alter table public.matches
  add column audience text not null default 'mixed' check (audience in ('men', 'women', 'mixed'));

-- A host can only open a men or women match for their own gender
create function public.check_match_audience()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if new.audience = 'mixed' then
    return new;
  end if;
  -- Admin tools and our own functions may set anything
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if (select gender from public.profiles where id = new.host_id)
     is distinct from (case new.audience when 'men' then 'male' else 'female' end) then
    raise exception 'You can only host a match for your own gender';
  end if;
  return new;
end;
$$;

revoke all on function public.check_match_audience() from public, anon, authenticated;

create trigger matches_check_audience
  before insert or update of audience on public.matches
  for each row execute function public.check_match_audience();

-- The audience changes only while nobody else has joined, like the time, level and type
create or replace function public.check_match_edit()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  -- Admin tools and our own functions may change anything
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if new.starts_at is not distinct from old.starts_at
     and new.level_min is not distinct from old.level_min
     and new.level_max is not distinct from old.level_max
     and new.kind is not distinct from old.kind
     and new.audience is not distinct from old.audience
     and new.court_id is not distinct from old.court_id then
    return new;
  end if;

  if old.status <> 'open' then
    raise exception 'This match was cancelled';
  end if;
  if old.starts_at <= now() then
    raise exception 'This match has already started';
  end if;

  if new.starts_at is distinct from old.starts_at
     or new.level_min is distinct from old.level_min
     or new.level_max is distinct from old.level_max
     or new.kind is distinct from old.kind
     or new.audience is distinct from old.audience then
    if exists (
      select 1 from public.match_players
      where match_id = old.id and player_id <> old.host_id
    ) then
      raise exception 'Players have joined, so the time, level and type can''t change';
    end if;
    if new.starts_at <= now() then
      raise exception 'Pick a time that hasn''t passed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger matches_check_edit on public.matches;
create trigger matches_check_edit
  before update of starts_at, level_min, level_max, kind, audience, court_id on public.matches
  for each row execute function public.check_match_edit();

-- join_match with the gender check added after the level check
create or replace function public.join_match(p_match_id uuid, p_seat smallint)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_level numeric;
  v_gender text;
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

  select level, gender into v_level, v_gender from public.profiles where id = v_uid;
  if v_level is not null
     and (v_level < v_match.level_min - c_level_margin or v_level > v_match.level_max + c_level_margin) then
    raise exception 'Your level is outside this match''s range';
  end if;
  if v_match.audience = 'men' and v_gender is distinct from 'male' then
    raise exception 'This match is for men only';
  end if;
  if v_match.audience = 'women' and v_gender is distinct from 'female' then
    raise exception 'This match is for women only';
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
