create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) > 0),
  last_name text not null check (char_length(btrim(last_name)) > 0),
  -- The 8 digits after +216
  phone text not null check (phone ~ '^[0-9]{8}$'),
  city text not null,
  bio text not null default '' check (char_length(bio) <= 150),
  hand text not null default 'right' check (hand in ('right', 'left')),
  side text not null default 'right' check (side in ('left', 'right', 'both')),
  play_style text not null default 'balanced'
    check (play_style in ('aggressive', 'balanced', 'defensive', 'tactical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Players read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Players create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Players update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create function public.set_updated_at()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
