-- What the player preview and full profile show about another player beyond
-- their card: how they play, their bio, friends, the clubs they play at and
-- how often you've shared a court. The phone number and other private
-- details stay out, as in get_player_cards.
create function public.get_player_profile(p_player_id uuid)
  returns table (
    side text,
    hand text,
    bio text,
    friend_count integer,
    club_names text[],
    played_together integer,
    last_played_together_at timestamptz
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select
    p.side,
    p.hand,
    p.bio,
    (select count(*)::integer from public.connections c
     where c.status = 'accepted' and p.id in (c.requester_id, c.addressee_id)),
    coalesce((select array_agg(club_name order by plays desc, last_at desc)
              from (select club_name, count(*) as plays, max(played_at) as last_at
                    from public.played_matches()
                    where player_id = p.id and club_id is not null
                    group by club_name
                    order by count(*) desc, max(played_at) desc
                    limit 2) top_clubs), '{}'),
    (select count(*)::integer
     from public.played_matches() theirs
     join public.played_matches() mine on mine.match_id = theirs.match_id
     where theirs.player_id = p.id and mine.player_id = auth.uid()),
    (select max(theirs.played_at)
     from public.played_matches() theirs
     join public.played_matches() mine on mine.match_id = theirs.match_id
     where theirs.player_id = p.id and mine.player_id = auth.uid())
  from public.profiles p
  where p.id = p_player_id
    and auth.uid() is not null;
$$;

revoke all on function public.get_player_profile(uuid) from public, anon;
grant execute on function public.get_player_profile(uuid) to authenticated;
