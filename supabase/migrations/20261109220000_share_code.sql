-- Share profile with a QR code: every player gets a short, random, unique code. It goes in the
-- QR and the link (padelna://u/<code>), so the player's id and name never do. Scanning a code
-- shows the player's card and a Connect button.

-- 10 hex characters from a random uuid: 40 bits, so codes can't be guessed one by one.
create function public.new_share_code()
  returns text
  language sql
  volatile
  set search_path = ''
as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
$$;

revoke all on function public.new_share_code() from public, anon;
grant execute on function public.new_share_code() to authenticated, service_role;

-- A volatile default is evaluated per row, so existing players get their own code
alter table public.profiles
  add column share_code text not null default public.new_share_code();

alter table public.profiles
  add constraint profiles_share_code_key unique (share_code);

-- profiles uses column-level grants. Players read their own code (RLS keeps it to their own
-- row) but never change it, so there is no insert or update grant.
grant select (share_code) on public.profiles to authenticated;

-- Who a code belongs to: the public card (no phone or private details), how you relate to
-- them, how they play, a few numbers and up to two friends you have in common. No rows when
-- the code matches nobody.
create function public.get_player_by_code(p_code text)
  returns table (
    id uuid,
    first_name text,
    last_name text,
    city text,
    level numeric,
    avatar_url text,
    connection text,
    club_name text,
    mutual_count integer,
    side text,
    play_style text,
    friend_count integer,
    matches_played integer,
    matches_scored integer,
    wins integer,
    mutual_friends jsonb
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select
    p.id, p.first_name, p.last_name, p.city, p.level, p.avatar_url,
    public.connection_status(auth.uid(), p.id),
    (select pm.club_name from public.played_matches() pm
     where pm.player_id = p.id and pm.club_name is not null
     order by pm.played_at desc limit 1),
    public.mutual_connection_count(auth.uid(), p.id),
    p.side,
    p.play_style,
    (select count(*)::integer from public.connections c
     where c.status = 'accepted' and p.id in (c.requester_id, c.addressee_id)),
    (st.j ->> 'matches_played')::integer,
    (st.j ->> 'matches_scored')::integer,
    (st.j ->> 'wins')::integer,
    (select coalesce(jsonb_agg(jsonb_build_object(
              'id', f.id, 'first_name', f.first_name, 'last_name', f.last_name,
              'avatar_url', f.avatar_url) order by f.first_name), '[]'::jsonb)
     from (
       select fp.id, fp.first_name, fp.last_name, fp.avatar_url
       from public.profiles fp
       where fp.id in (
         select case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end
         from public.connections c
         where c.status = 'accepted' and auth.uid() in (c.requester_id, c.addressee_id)
         intersect
         select case when c.requester_id = p.id then c.addressee_id else c.requester_id end
         from public.connections c
         where c.status = 'accepted' and p.id in (c.requester_id, c.addressee_id)
       )
       order by fp.first_name
       limit 2
     ) f)
  from public.profiles p
  cross join lateral public.player_stats(p.id) as st(j)
  where p.share_code = lower(btrim(p_code))
    and auth.uid() is not null;
$$;

revoke all on function public.get_player_by_code(text) from public, anon;
grant execute on function public.get_player_by_code(text) to authenticated;
