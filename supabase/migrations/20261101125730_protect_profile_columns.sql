-- Players could update every column of their own profile, and any column added
-- later would have been writable too. They now get only the columns the app sends,
-- so new ones such as status stay out of reach by default.
revoke insert, update on public.profiles from anon, authenticated;

grant insert (
  id, first_name, last_name, phone, city, bio, hand, side, play_style, level, avatar_url
) on public.profiles to authenticated;

-- saveProfile is an upsert that sends id, phone and level, and Postgres checks
-- these rights even when no row conflicts, so they have to stay granted.
grant update (
  id, first_name, last_name, phone, city, bio, hand, side, play_style, level, avatar_url
) on public.profiles to authenticated;

-- Level and phone are set once, at profile setup. A later change from the app keeps
-- the saved value without an error, so a setup retry can't undo an admin's level.
-- Not security definer: current_user tells a player's request from an admin_* function.
create function public.protect_profile_columns()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.level := coalesce(old.level, new.level);
    new.phone := old.phone;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_profile_columns() from public, anon, authenticated;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();
