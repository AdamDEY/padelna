-- New share codes are 6 easy-to-read characters, like 4XZ123: capital letters and digits, without
-- 0, O, 1, I and L so they can't be misread. 31 characters over 6 places is about 887 million codes.
-- Codes already given out (10 hex characters) keep working: the lookup ignores case.

alter table public.profiles alter column share_code drop default;
drop function public.new_share_code();

-- Internal: it has to see every profile to keep codes unique, so it runs with the owner's rights.
create function public.new_share_code()
  returns text
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  c_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text;
  v_position integer;
begin
  loop
    v_code := '';
    for v_position in 1..6 loop
      v_code := v_code || substr(c_alphabet, 1 + floor(random() * length(c_alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where upper(share_code) = v_code);
  end loop;

  return v_code;
end;
$$;

revoke all on function public.new_share_code() from public, anon, authenticated;

-- A new profile gets its code when it is created. The code never changes afterwards, so links
-- and QR codes keep working.
create function public.set_share_code()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if new.share_code is null then
    new.share_code := public.new_share_code();
  end if;
  return new;
end;
$$;

revoke all on function public.set_share_code() from public, anon, authenticated;

create trigger profiles_set_share_code
  before insert on public.profiles
  for each row execute function public.set_share_code();

-- Same function as before, but the code is matched without regard to case
create or replace function public.get_player_by_code(p_code text)
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
  where upper(p.share_code) = upper(btrim(p_code))
    and auth.uid() is not null;
$$;
