-- Clubs and courts, matches and their players. Clubs and courts are read-only
-- from the app; a CMS will manage them later.

create table public.clubs (
  -- Same ids as the app's club routes, e.g. club-lac
  id text primary key,
  name text not null unique,
  area text not null,
  region text not null,
  created_at timestamptz not null default now()
);

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  club_id text not null references public.clubs (id) on delete cascade,
  number smallint not null check (number between 1 and 50),
  unique (club_id, number)
);

alter table public.clubs enable row level security;
alter table public.courts enable row level security;

create policy "Signed-in players read clubs"
  on public.clubs for select to authenticated using (true);
create policy "Signed-in players read courts"
  on public.courts for select to authenticated using (true);

insert into public.clubs (id, name, area, region) values
  ('club-lac', 'Lac Padel Arena', 'Les Berges du Lac', 'Tunis'),
  ('club-gammarth', 'Gammarth Padel', 'Gammarth', 'Tunis'),
  ('club-marsa', 'La Marsa Padel', 'La Marsa', 'Tunis'),
  ('club-ennasr', 'Ennasr Padel Club', 'Ennasr', 'Ariana'),
  ('club-menzah', 'Padel House Menzah', 'El Menzah', 'Ariana'),
  ('club-megrine', 'Megrine Padel', 'Megrine', 'Ben Arous'),
  ('club-hammamet', 'Hammamet Padel Club', 'Yasmine Hammamet', 'Nabeul'),
  ('club-sousse', 'Sousse Padel Center', 'Port El Kantaoui', 'Sousse'),
  ('club-sfax', 'Sfax Padel Club', 'Sfax Ville', 'Sfax');

insert into public.courts (club_id, number)
select club_id, number
from (values
  ('club-lac', 6), ('club-gammarth', 4), ('club-marsa', 5), ('club-ennasr', 4),
  ('club-menzah', 3), ('club-megrine', 4), ('club-hammamet', 6), ('club-sousse', 5),
  ('club-sfax', 4)
) as counts (club_id, court_count)
cross join lateral generate_series(1, counts.court_count) as number;

-- What other players may see about a player. The phone and the rest of the
-- profile stay private to its owner, so this view is the only way in.
create view public.player_cards as
  select id, first_name, last_name, city, level, avatar_url
  from public.profiles;

revoke all on public.player_cards from anon;
grant select on public.player_cards to authenticated;

create extension if not exists btree_gist;

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  -- Set once the host has booked a court; the club comes from the court
  court_id uuid references public.courts (id),
  starts_at timestamptz not null,
  -- Every match lasts 90 minutes
  duration_minutes smallint not null default 90 check (duration_minutes = 90),
  level_min numeric(2, 1) not null check (level_min between 1 and 7),
  level_max numeric(2, 1) not null check (level_max between 1 and 7),
  kind text not null default 'friendly' check (kind in ('friendly', 'competitive')),
  -- How many spots the host still wants to fill (the other seats are the host and their guests)
  players_needed smallint not null check (players_needed between 1 and 3),
  -- Per player, in TND; comes from the club later
  price numeric(6, 2) check (price >= 0),
  note text not null default '' check (char_length(note) <= 300),
  status text not null default 'open' check (status in ('open', 'cancelled')),
  created_at timestamptz not null default now(),
  check (level_min <= level_max),
  -- Start times are in half-hour steps, Tunisian time
  check (
    date_trunc('minute', starts_at) = starts_at
    and extract(minute from starts_at at time zone 'Africa/Tunis') in (0, 30)
  ),
  -- A host can't run two open matches that overlap
  -- (UTC timestamps, because adding an interval to a timestamptz isn't immutable)
  exclude using gist (
    host_id with =,
    tsrange(
      (starts_at at time zone 'UTC'),
      (starts_at at time zone 'UTC') + interval '90 minutes'
    ) with &&
  ) where (status = 'open')
);

create index matches_starts_at_idx on public.matches (starts_at);

create table public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  -- Seats 1-2 are one team, 3-4 the other
  seat smallint not null check (seat between 1 and 4),
  player_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, player_id)
);

create index match_players_player_idx on public.match_players (player_id);

alter table public.matches enable row level security;
alter table public.match_players enable row level security;

create policy "Signed-in players read matches"
  on public.matches for select to authenticated using (true);
create policy "Players host their own matches"
  on public.matches for insert to authenticated
  with check ((select auth.uid()) = host_id and starts_at > now());
create policy "Hosts update their own matches"
  on public.matches for update to authenticated
  using ((select auth.uid()) = host_id)
  with check ((select auth.uid()) = host_id);

create policy "Signed-in players read line-ups"
  on public.match_players for select to authenticated using (true);

-- The host takes seat 1 as soon as the match exists
create function public.add_host_to_match()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.match_players (match_id, seat, player_id)
  values (new.id, 1, new.host_id);
  return new;
end;
$$;

revoke all on function public.add_host_to_match() from public, anon, authenticated;

create trigger matches_add_host
  after insert on public.matches
  for each row execute function public.add_host_to_match();
