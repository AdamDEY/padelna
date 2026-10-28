-- Replaces the player_cards view: the linter flags security-definer views as
-- an error. Same idea as a function: other players only ever see these
-- columns, never the phone or the rest of the profile.
drop view public.player_cards;

create function public.get_player_cards(player_ids uuid[])
  returns table (
    id uuid,
    first_name text,
    last_name text,
    city text,
    level numeric,
    avatar_url text
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p.id, p.first_name, p.last_name, p.city, p.level, p.avatar_url
  from public.profiles p
  where p.id = any (player_ids);
$$;

revoke all on function public.get_player_cards(uuid[]) from public, anon;
grant execute on function public.get_player_cards(uuid[]) to authenticated;

-- Keep extensions out of the public schema
alter extension btree_gist set schema extensions;
