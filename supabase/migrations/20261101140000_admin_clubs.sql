-- The full club profile, managed from the admin dashboard. Every write goes through
-- an admin_* function that checks the admin role and records itself in admin_actions.

-- Existing clubs stay visible; new ones start as drafts
alter table public.clubs
  add column description text not null default '' check (char_length(description) <= 500),
  add column address text not null default '',
  add column city text not null default '',
  add column latitude numeric(9, 6) check (latitude between -90 and 90),
  add column longitude numeric(9, 6) check (longitude between -180 and 180),
  add column phone text check (phone ~ '^[0-9]{8}$'),
  add column whatsapp text check (whatsapp ~ '^[0-9]{8}$'),
  add column website text,
  add column instagram text,
  add column facebook text,
  add column price_offpeak numeric(6, 2) check (price_offpeak >= 0),
  add column price_peak numeric(6, 2) check (price_peak >= 0),
  add column facilities text[] not null default '{}' check (facilities <@ array[
    'parking', 'showers', 'changing_rooms', 'cafe', 'pro_shop', 'racket_rental',
    'balls_for_sale', 'coaching', 'air_conditioned_indoor'
  ]::text[]),
  add column status text not null default 'published'
    check (status in ('draft', 'published', 'temporarily_closed', 'closed')),
  add column closed_note text,
  add column featured boolean not null default false,
  add column updated_at timestamptz not null default now(),
  add check (status <> 'temporarily_closed' or char_length(btrim(closed_note)) > 0),
  add check ((latitude is null) = (longitude is null));

alter table public.clubs alter column status set default 'draft';

-- The closest thing the existing rows have to a city; ops can correct it per club
update public.clubs set city = region;

create trigger clubs_set_updated_at
  before update on public.clubs
  for each row execute function public.set_updated_at();

alter table public.courts
  add column indoor boolean not null default false,
  add column lighting boolean not null default false,
  add column active boolean not null default true;

-- Players don't see drafts. Closed clubs and switched-off courts stay readable because
-- past matches still show them; the app leaves them out when creating a match.
drop policy "Signed-in players read clubs" on public.clubs;
create policy "Signed-in players read visible clubs"
  on public.clubs for select to authenticated
  using (status <> 'draft' or (select public.is_admin()));

drop policy "Signed-in players read courts" on public.courts;
create policy "Signed-in players read courts of visible clubs"
  on public.courts for select to authenticated
  using (exists (select 1 from public.clubs c where c.id = club_id));

-- Day 1 is Monday. Closing before opening means after midnight.
create table public.club_hours (
  club_id text not null references public.clubs (id) on delete cascade,
  day smallint not null check (day between 1 and 7),
  closed boolean not null default false,
  opens_at time,
  closes_at time,
  primary key (club_id, day),
  check (closed or (opens_at is not null and closes_at is not null and opens_at <> closes_at))
);

alter table public.club_hours enable row level security;
revoke all on public.club_hours from anon, authenticated;
grant select on public.club_hours to authenticated;

create policy "Signed-in players read hours of visible clubs"
  on public.club_hours for select to authenticated
  using (exists (select 1 from public.clubs c where c.id = club_id));

create table public.club_photos (
  id uuid primary key default gen_random_uuid(),
  club_id text not null references public.clubs (id) on delete cascade,
  file_path text not null unique,
  position integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index club_photos_club_idx on public.club_photos (club_id, position);
create unique index club_photos_one_cover_idx on public.club_photos (club_id) where is_cover;

alter table public.club_photos enable row level security;
revoke all on public.club_photos from anon, authenticated;
grant select on public.club_photos to authenticated;

create policy "Signed-in players read photos of visible clubs"
  on public.club_photos for select to authenticated
  using (exists (select 1 from public.clubs c where c.id = club_id));

-- Files live at club-photos/<club id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-photos', 'club-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Signed-in players read club photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'club-photos');

create policy "Admins upload club photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'club-photos' and (select public.is_admin()));

create policy "Admins delete club photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'club-photos' and (select public.is_admin()));

-- A new match can't use a closed club or a switched-off court, even before the app's
-- list filters them out. The message is what the player sees. Not security definer:
-- current_user lets admin_* functions through later.
create function public.check_match_court()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
declare
  v_active boolean;
  v_status text;
begin
  if new.court_id is null or current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.court_id is not distinct from old.court_id then
    return new;
  end if;

  select ct.active, c.status into v_active, v_status
  from public.courts ct
  join public.clubs c on c.id = ct.club_id
  where ct.id = new.court_id;

  if not found or v_status <> 'published' then
    raise exception 'This club isn''t open for new matches. Pick another one.';
  end if;
  if not v_active then
    raise exception 'This court isn''t available. Pick another one.';
  end if;
  return new;
end;
$$;

revoke all on function public.check_match_court() from public, anon, authenticated;

create trigger matches_check_court
  before insert or update of court_id on public.matches
  for each row execute function public.check_match_court();

-- Whether any match, played or not, points to this club
create function public.club_has_matches(p_club_id text)
  returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    join public.courts ct on ct.id = m.court_id
    where ct.club_id = p_club_id
  );
$$;

revoke all on function public.club_has_matches(text) from public, anon, authenticated;

-- The club list. Matches count the same way as played_matches: over, with all seats taken.
create function public.admin_list_clubs()
  returns table (
    id text, name text, area text, region text, city text, status text, featured boolean,
    indoor_courts integer, outdoor_courts integer, photo_count integer,
    matches_30d integer, updated_at timestamptz
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  perform public.assert_admin();

  return query
  select
    c.id, c.name, c.area, c.region, c.city, c.status, c.featured,
    (select count(*)::integer from public.courts ct where ct.club_id = c.id and ct.active and ct.indoor),
    (select count(*)::integer from public.courts ct where ct.club_id = c.id and ct.active and not ct.indoor),
    (select count(*)::integer from public.club_photos p where p.club_id = c.id),
    (
      select count(*)::integer
      from public.matches m
      join public.courts ct on ct.id = m.court_id
      where ct.club_id = c.id
        and m.status = 'open'
        and m.starts_at >= now() - interval '30 days'
        and m.starts_at + make_interval(mins => m.duration_minutes) <= now()
        and (select count(*) from public.match_players mp where mp.match_id = m.id) = m.players_needed + 1
    ),
    c.updated_at
  from public.clubs c
  order by c.name;
end;
$$;

revoke all on function public.admin_list_clubs() from public, anon;
grant execute on function public.admin_list_clubs() to authenticated;

-- Adds or edits a club and its hours. p_club holds the profile fields. The short id is
-- set once, so p_is_new stops a new club from overwriting an existing one.
create function public.admin_upsert_club(
  p_id text,
  p_is_new boolean,
  p_club jsonb,
  p_hours jsonb,
  p_reason text default null
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_before public.clubs%rowtype;
  v_after public.clubs%rowtype;
  v_name text := btrim(coalesce(p_club ->> 'name', ''));
  v_area text := btrim(coalesce(p_club ->> 'area', ''));
  v_region text := btrim(coalesce(p_club ->> 'region', ''));
  v_city text := btrim(coalesce(p_club ->> 'city', ''));
  v_phone text := nullif(btrim(coalesce(p_club ->> 'phone', '')), '');
  v_whatsapp text := nullif(btrim(coalesce(p_club ->> 'whatsapp', '')), '');
  v_latitude numeric := nullif(p_club ->> 'latitude', '')::numeric;
  v_longitude numeric := nullif(p_club ->> 'longitude', '')::numeric;
  v_price_offpeak numeric := nullif(p_club ->> 'price_offpeak', '')::numeric;
  v_price_peak numeric := nullif(p_club ->> 'price_peak', '')::numeric;
  v_facilities text[] := array(select jsonb_array_elements_text(coalesce(p_club -> 'facilities', '[]'::jsonb)));
begin
  perform public.assert_admin();

  if v_name = '' or v_area = '' or v_region = '' or v_city = '' then
    raise exception 'Add the club''s name, area, region and city';
  end if;
  if v_phone !~ '^[0-9]{8}$' or v_whatsapp !~ '^[0-9]{8}$' then
    raise exception 'Phone and WhatsApp need the 8 digits after +216';
  end if;
  if (v_latitude is null) <> (v_longitude is null) then
    raise exception 'The map pin needs both latitude and longitude';
  end if;
  if char_length(coalesce(p_club ->> 'description', '')) > 500 then
    raise exception 'The description can be up to 500 characters';
  end if;

  if p_is_new then
    if p_id is null or p_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'The short id can only use lowercase letters, numbers and dashes, like club-lac';
    end if;
    if exists (select 1 from public.clubs where id = p_id) then
      raise exception 'Another club already uses this short id';
    end if;
    insert into public.clubs (id, name, area, region, city)
    values (p_id, v_name, v_area, v_region, v_city);
  else
    select * into v_before from public.clubs where id = p_id for update;
    if not found then
      raise exception 'This club no longer exists';
    end if;
  end if;

  update public.clubs set
    name = v_name,
    area = v_area,
    region = v_region,
    city = v_city,
    description = coalesce(p_club ->> 'description', ''),
    address = btrim(coalesce(p_club ->> 'address', '')),
    latitude = v_latitude,
    longitude = v_longitude,
    phone = v_phone,
    whatsapp = v_whatsapp,
    website = nullif(btrim(coalesce(p_club ->> 'website', '')), ''),
    instagram = nullif(btrim(coalesce(p_club ->> 'instagram', '')), ''),
    facebook = nullif(btrim(coalesce(p_club ->> 'facebook', '')), ''),
    price_offpeak = v_price_offpeak,
    price_peak = v_price_peak,
    facilities = v_facilities,
    featured = coalesce((p_club ->> 'featured')::boolean, false)
  where id = p_id
  returning * into v_after;

  if p_hours is not null then
    if exists (
      select 1 from jsonb_to_recordset(p_hours) as h (day smallint, closed boolean, opens_at time, closes_at time)
      where not coalesce(h.closed, false)
        and (h.opens_at is null or h.closes_at is null or h.opens_at = h.closes_at)
    ) then
      raise exception 'Add opening and closing times, or mark the day closed';
    end if;

    delete from public.club_hours where club_id = p_id;
    insert into public.club_hours (club_id, day, closed, opens_at, closes_at)
    select p_id, h.day, coalesce(h.closed, false),
      case when coalesce(h.closed, false) then null else h.opens_at end,
      case when coalesce(h.closed, false) then null else h.closes_at end
    from jsonb_to_recordset(p_hours) as h (day smallint, closed boolean, opens_at time, closes_at time);
  end if;

  perform public.log_admin_action(
    case when p_is_new then 'create_club' else 'update_club' end,
    'club', p_id,
    case when p_is_new then null else to_jsonb(v_before) end,
    to_jsonb(v_after), p_reason
  );
exception
  when unique_violation then
    raise exception 'Another club already has this name';
end;
$$;

revoke all on function public.admin_upsert_club(text, boolean, jsonb, jsonb, text) from public, anon;
grant execute on function public.admin_upsert_club(text, boolean, jsonb, jsonb, text) to authenticated;

create function public.admin_set_club_status(
  p_id text,
  p_status text,
  p_closed_note text,
  p_reason text
)
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

  if char_length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Add a reason';
  end if;
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

revoke all on function public.admin_set_club_status(text, text, text, text) from public, anon;
grant execute on function public.admin_set_club_status(text, text, text, text) to authenticated;

-- Only for a club no match has used. Returns its photo files for the dashboard to
-- remove, because database functions can't delete from storage.
create function public.admin_delete_club(p_id text, p_reason text)
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

  if char_length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Add a reason';
  end if;

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

revoke all on function public.admin_delete_club(text, text) from public, anon;
grant execute on function public.admin_delete_club(text, text) to authenticated;

-- Adds a court when p_court_id is null, otherwise edits it
create function public.admin_upsert_court(
  p_club_id text,
  p_court_id uuid,
  p_number integer,
  p_indoor boolean,
  p_lighting boolean,
  p_active boolean,
  p_reason text default null
)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_before public.courts%rowtype;
  v_after public.courts%rowtype;
begin
  perform public.assert_admin();

  if p_number is null or p_number not between 1 and 50 then
    raise exception 'The court number goes from 1 to 50';
  end if;
  if not exists (select 1 from public.clubs where id = p_club_id) then
    raise exception 'This club no longer exists';
  end if;

  if p_court_id is null then
    insert into public.courts (club_id, number, indoor, lighting, active)
    values (p_club_id, p_number, coalesce(p_indoor, false), coalesce(p_lighting, false), coalesce(p_active, true))
    returning * into v_after;
  else
    select * into v_before from public.courts where id = p_court_id and club_id = p_club_id for update;
    if not found then
      raise exception 'This court no longer exists';
    end if;
    -- Past matches name the court by its number
    if p_number <> v_before.number and exists (select 1 from public.matches where court_id = p_court_id) then
      raise exception 'This court has matches, so its number can''t change';
    end if;
    update public.courts set
      number = p_number,
      indoor = coalesce(p_indoor, indoor),
      lighting = coalesce(p_lighting, lighting),
      active = coalesce(p_active, active)
    where id = p_court_id
    returning * into v_after;
  end if;

  update public.clubs set updated_at = now() where id = p_club_id;

  perform public.log_admin_action(
    case when p_court_id is null then 'create_court' else 'update_court' end,
    'court', v_after.id::text,
    case when p_court_id is null then null else to_jsonb(v_before) end,
    to_jsonb(v_after), p_reason
  );
  return v_after.id;
exception
  when unique_violation then
    raise exception 'This club already has a court with that number';
end;
$$;

revoke all on function public.admin_upsert_court(text, uuid, integer, boolean, boolean, boolean, text) from public, anon;
grant execute on function public.admin_upsert_court(text, uuid, integer, boolean, boolean, boolean, text) to authenticated;

-- A court a match has used is switched off instead
create function public.admin_delete_court(p_court_id uuid, p_reason text default null)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_before public.courts%rowtype;
begin
  perform public.assert_admin();

  select * into v_before from public.courts where id = p_court_id for update;
  if not found then
    raise exception 'This court no longer exists';
  end if;
  if exists (select 1 from public.matches where court_id = p_court_id) then
    raise exception 'This court has matches, so it can''t be deleted. Switch it off instead.';
  end if;

  delete from public.courts where id = p_court_id;
  update public.clubs set updated_at = now() where id = v_before.club_id;

  perform public.log_admin_action('delete_court', 'court', p_court_id::text, to_jsonb(v_before), null, p_reason);
end;
$$;

revoke all on function public.admin_delete_court(uuid, text) from public, anon;
grant execute on function public.admin_delete_court(uuid, text) to authenticated;

-- Registers a file the dashboard just uploaded. The club's first photo becomes its cover.
create function public.admin_add_club_photo(p_club_id text, p_file_path text)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.assert_admin();

  if p_file_path is null or split_part(p_file_path, '/', 1) <> p_club_id then
    raise exception 'That photo doesn''t belong to this club';
  end if;
  perform 1 from public.clubs where id = p_club_id for update;
  if not found then
    raise exception 'This club no longer exists';
  end if;

  insert into public.club_photos (club_id, file_path, position, is_cover)
  values (
    p_club_id,
    p_file_path,
    coalesce((select max(position) + 1 from public.club_photos where club_id = p_club_id), 0),
    not exists (select 1 from public.club_photos where club_id = p_club_id)
  )
  returning id into v_id;

  update public.clubs set updated_at = now() where id = p_club_id;

  perform public.log_admin_action(
    'add_club_photo', 'club', p_club_id, null, jsonb_build_object('file_path', p_file_path), null
  );
  return v_id;
end;
$$;

revoke all on function public.admin_add_club_photo(text, text) from public, anon;
grant execute on function public.admin_add_club_photo(text, text) to authenticated;

-- Returns the file for the dashboard to remove. If the cover goes, the next photo takes over.
create function public.admin_delete_club_photo(p_photo_id uuid)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_before public.club_photos%rowtype;
begin
  perform public.assert_admin();

  select * into v_before from public.club_photos where id = p_photo_id for update;
  if not found then
    raise exception 'This photo no longer exists';
  end if;

  delete from public.club_photos where id = p_photo_id;

  if v_before.is_cover then
    update public.club_photos set is_cover = true
    where id = (
      select id from public.club_photos
      where club_id = v_before.club_id
      order by position, created_at
      limit 1
    );
  end if;

  update public.clubs set updated_at = now() where id = v_before.club_id;

  perform public.log_admin_action(
    'delete_club_photo', 'club', v_before.club_id, to_jsonb(v_before), null, null
  );
  return v_before.file_path;
end;
$$;

revoke all on function public.admin_delete_club_photo(uuid) from public, anon;
grant execute on function public.admin_delete_club_photo(uuid) to authenticated;

create function public.admin_set_club_cover(p_photo_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_club_id text;
begin
  perform public.assert_admin();

  select club_id into v_club_id from public.club_photos where id = p_photo_id;
  if not found then
    raise exception 'This photo no longer exists';
  end if;

  -- In this order, so a club never has two covers
  update public.club_photos set is_cover = false where club_id = v_club_id and is_cover;
  update public.club_photos set is_cover = true where id = p_photo_id;
  update public.clubs set updated_at = now() where id = v_club_id;

  perform public.log_admin_action(
    'set_club_cover', 'club', v_club_id, null, jsonb_build_object('photo_id', p_photo_id), null
  );
end;
$$;

revoke all on function public.admin_set_club_cover(uuid) from public, anon;
grant execute on function public.admin_set_club_cover(uuid) to authenticated;

-- p_photo_ids must list every photo of the club, in the new order
create function public.admin_reorder_club_photos(p_club_id text, p_photo_ids uuid[])
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform public.assert_admin();

  if (select array_agg(id order by id) from public.club_photos where club_id = p_club_id)
     is distinct from (select array_agg(photo_id order by photo_id) from unnest(p_photo_ids) as photo_id) then
    raise exception 'The photos changed. Reload the page and try again.';
  end if;

  update public.club_photos p
  set position = o.ordinality - 1
  from unnest(p_photo_ids) with ordinality as o (photo_id, ordinality)
  where p.id = o.photo_id;

  update public.clubs set updated_at = now() where id = p_club_id;

  perform public.log_admin_action(
    'reorder_club_photos', 'club', p_club_id, null, jsonb_build_object('photo_ids', p_photo_ids), null
  );
end;
$$;

revoke all on function public.admin_reorder_club_photos(text, uuid[]) from public, anon;
grant execute on function public.admin_reorder_club_photos(text, uuid[]) to authenticated;
