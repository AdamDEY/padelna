-- Admin dashboard, Matches: read-only. The week calendar asks for every match that starts in a
-- time range and works out the rest (flags, same-time groups, counters) itself.

-- One row per match starting in [p_from, p_to). Cancelled matches are included, so the
-- calendar can show them struck through. seats_filled counts match_players rows; a match has
-- players_needed + 1 seats. court_id is null while the host hasn't booked a court, and then
-- the club columns are null too.
create function public.admin_list_matches(p_from timestamptz, p_to timestamptz)
  returns table (
    id uuid,
    starts_at timestamptz,
    kind text,
    status text,
    origin text,
    level_min numeric,
    level_max numeric,
    price numeric,
    seats_total integer,
    seats_filled integer,
    court_id uuid,
    court_number integer,
    indoor boolean,
    club_id text,
    club_name text,
    club_city text,
    host_id uuid,
    host_name text,
    score_status text
  )
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  perform public.assert_admin();

  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'Pick a time range that ends after it starts';
  end if;
  -- A week is what the calendar asks for; this keeps one call from reading the whole table
  if p_to - p_from > interval '45 days' then
    raise exception 'The time range can be up to 45 days';
  end if;

  return query
  select
    m.id, m.starts_at, m.kind, m.status, m.origin, m.level_min, m.level_max, m.price,
    (m.players_needed + 1)::integer,
    (select count(*) from public.match_players mp where mp.match_id = m.id)::integer,
    m.court_id, ct.number::integer, ct.indoor,
    c.id, c.name, c.city,
    m.host_id, h.first_name || ' ' || h.last_name,
    case
      when s.status = 'pending' and s.expires_at <= now() then 'expired'
      else s.status
    end
  from public.matches m
  join public.profiles h on h.id = m.host_id
  left join public.courts ct on ct.id = m.court_id
  left join public.clubs c on c.id = ct.club_id
  left join public.match_scores s on s.match_id = m.id
  where m.starts_at >= p_from and m.starts_at < p_to
  order by m.starts_at, m.id;
end;
$$;

revoke all on function public.admin_list_matches(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_list_matches(timestamptz, timestamptz) to authenticated;
