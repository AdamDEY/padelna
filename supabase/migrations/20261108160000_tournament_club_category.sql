-- A tournament has a club (optional), a category (men, women or mixed) and a start date and time.
-- The create function takes them; the list and get functions return the club name too.
-- The date becomes a moment (starts_at); existing dates keep their day, at 00:00 Tunisian time.

alter table public.tournaments
  add column club_id text references public.clubs (id) on delete set null,
  add column category text not null default 'mixed' check (category in ('men', 'women', 'mixed'));

alter table public.tournaments add column starts_at timestamptz;
update public.tournaments
set starts_at = starts_on::timestamp at time zone 'Africa/Tunis'
where starts_on is not null;
alter table public.tournaments drop column starts_on;

drop function public.admin_create_tournament(text, text, date, smallint);

create function public.admin_create_tournament(
  p_name text,
  p_format text,
  p_starts_at timestamptz,
  p_group_count smallint,
  p_club_id text,
  p_category text
)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_id uuid;
  v_club text := nullif(btrim(coalesce(p_club_id, '')), '');
begin
  perform public.assert_admin();

  if p_format <> 'groups' then
    raise exception 'Only group-stage tournaments can be created for now';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Give the tournament a name';
  end if;
  if p_group_count not in (2, 4) then
    raise exception 'Use 2 or 4 groups';
  end if;
  if p_category not in ('men', 'women', 'mixed') then
    raise exception 'Choose men, women or mixed';
  end if;
  if v_club is not null and not exists (select 1 from public.clubs where id = v_club) then
    raise exception 'This club no longer exists';
  end if;

  insert into public.tournaments (name, format, starts_at, settings, status, club_id, category)
  values (
    btrim(p_name), p_format, p_starts_at,
    jsonb_build_object('group_count', p_group_count), 'setup', v_club, p_category
  )
  returning id into v_id;

  perform public.log_admin_action(
    'create_tournament', 'tournament', v_id::text, null,
    jsonb_build_object('name', btrim(p_name), 'format', p_format, 'club_id', v_club, 'category', p_category),
    null
  );
  return v_id;
end;
$$;

revoke all on function public.admin_create_tournament(text, text, timestamptz, smallint, text, text)
  from public, anon;
grant execute on function public.admin_create_tournament(text, text, timestamptz, smallint, text, text)
  to authenticated;

create or replace function public.admin_list_tournaments()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
begin
  perform public.assert_admin();

  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.created_at desc)
    from (
      select
        tn.id, tn.name, tn.format, tn.status, tn.starts_at, tn.created_at,
        tn.category, tn.club_id, c.name as club_name,
        (select count(*) from public.tournament_entries e where e.tournament_id = tn.id) as entries,
        (select count(*) from public.tournament_matches m where m.tournament_id = tn.id) as matches_total,
        (select count(*) from public.tournament_matches m
          where m.tournament_id = tn.id and m.winner_entry_id is not null) as matches_done
      from public.tournaments tn
      left join public.clubs c on c.id = tn.club_id
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_get_tournament(p_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
begin
  perform public.assert_admin();

  select * into v_tournament from public.tournaments where id = p_id;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'tournament',
      to_jsonb(v_tournament)
      || jsonb_build_object('club_name', (select name from public.clubs where id = v_tournament.club_id)),
    'entries', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.group_label, e.position)
      from public.tournament_entries e where e.tournament_id = p_id
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.stage desc, m.round, m.group_label, m.label)
      from public.tournament_matches m where m.tournament_id = p_id
    ), '[]'::jsonb)
  );
end;
$$;
