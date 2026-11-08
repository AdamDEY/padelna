-- Gender and birthday are asked in profile setup. Nullable so players who set up
-- before this change keep working; the app asks every new player for both.
alter table public.profiles
  add column gender text check (gender in ('male', 'female')),
  add column birth_date date check (birth_date <= current_date and birth_date >= date '1900-01-01');
