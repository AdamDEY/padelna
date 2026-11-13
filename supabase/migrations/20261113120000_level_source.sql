-- How a player's starting level was set, for the credibility shown on their profile and in the
-- player sheet: 'quiz' (they took the level quiz) or 'self' (they skipped it and picked a level).
-- Players who signed up before this have no source, so nothing is shown for them.
alter table public.profiles
  add column level_source text check (level_source in ('quiz', 'self'));

-- saveProfile sends it with the rest of profile setup. It is an upsert, and Postgres checks the
-- update right even when no row conflicts, so both rights are needed.
grant insert (level_source) on public.profiles to authenticated;
grant update (level_source) on public.profiles to authenticated;

-- Like the level and the phone, the source is set once at profile setup. A later change from the
-- app keeps the saved value without an error, so a retry can't make a placeholder level look earned.
create or replace function public.protect_profile_columns()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.level := coalesce(old.level, new.level);
    new.phone := old.phone;
    new.level_source := old.level_source;
  end if;
  return new;
end;
$$;

-- Any signed-in player can see how another player's level was set; nothing else from the profile.
create function public.get_level_source(p_player_id uuid)
  returns text
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p.level_source
  from public.profiles p
  where p.id = p_player_id and (select auth.uid()) is not null;
$$;

revoke all on function public.get_level_source(uuid) from public, anon;
grant execute on function public.get_level_source(uuid) to authenticated;
