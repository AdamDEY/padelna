-- A group chat per match, for the players in it: the host and everyone who joined.
-- A player who leaves loses access; one who joins sees the earlier messages.
--
-- Players write text messages. The database adds short notes for what happens to the
-- match (a player joined or left, the court was booked, the match was cancelled).

create table public.match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  -- Who wrote it, or who a note is about. Kept as null when their account is deleted.
  sender_id uuid default auth.uid() references public.profiles (id) on delete set null,
  kind text not null default 'text'
    check (kind in ('text', 'joined', 'joined_full', 'left', 'court_booked', 'cancelled')),
  body text not null default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  check (kind <> 'text' or char_length(btrim(body)) > 0)
);

create index match_messages_match_idx on public.match_messages (match_id, created_at desc);

-- Whether the signed-in player has a seat in the match. Security definer so policies
-- can call it without match_players' own policies getting in the way.
create function public.is_in_match(p_match_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from public.match_players
    where match_id = p_match_id and player_id = (select auth.uid())
  );
$$;

revoke all on function public.is_in_match(uuid) from public, anon;
grant execute on function public.is_in_match(uuid) to authenticated;

alter table public.match_messages enable row level security;

revoke all on public.match_messages from anon, authenticated;
grant select on public.match_messages to authenticated;
-- The sender and kind come from their defaults, so a player can only send text as themselves
grant insert (match_id, body) on public.match_messages to authenticated;

create policy "Players read their match's chat"
  on public.match_messages for select to authenticated
  using ((select public.is_in_match(match_id)));

create policy "Players write in their match's chat"
  on public.match_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and kind = 'text'
    and (select public.is_in_match(match_id))
    and exists (select 1 from public.matches where id = match_id and status = 'open')
  );

-- When each player last opened a chat, for the unread dot
create table public.match_chat_reads (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

alter table public.match_chat_reads enable row level security;
revoke all on public.match_chat_reads from anon, authenticated;

create function public.mark_match_chat_read(p_match_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not public.is_in_match(p_match_id) then
    return;
  end if;
  insert into public.match_chat_reads (match_id, player_id, last_read_at)
  values (p_match_id, auth.uid(), now())
  on conflict (match_id, player_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

-- Messages from others since you last opened the chat (0 when you're not in the match)
create function public.match_chat_unread_count(p_match_id uuid)
  returns integer
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select count(*)::integer
  from public.match_messages m
  where m.match_id = p_match_id
    and public.is_in_match(p_match_id)
    and m.sender_id is distinct from auth.uid()
    and m.created_at > coalesce(
      (select last_read_at from public.match_chat_reads
       where match_id = p_match_id and player_id = auth.uid()),
      '-infinity'::timestamptz
    );
$$;

revoke all on function public.mark_match_chat_read(uuid) from public, anon;
revoke all on function public.match_chat_unread_count(uuid) from public, anon;
grant execute on function public.mark_match_chat_read(uuid) to authenticated;
grant execute on function public.match_chat_unread_count(uuid) to authenticated;

-- Notes for joins and leaves. The host's own seat (added with the match) gets none.
-- When a match or an account is deleted, its seats go too; nothing is written then.
create function public.note_match_player_change()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_row public.match_players%rowtype;
  v_kind text;
begin
  if tg_op = 'INSERT' then
    v_row := new;
  else
    v_row := old;
  end if;

  select * into v_match from public.matches where id = v_row.match_id;
  if not found or v_row.player_id = v_match.host_id then
    return null;
  end if;
  if not exists (select 1 from public.profiles where id = v_row.player_id) then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_kind := case
      when (select count(*) from public.match_players where match_id = v_row.match_id)
           >= v_match.players_needed + 1 then 'joined_full'
      else 'joined'
    end;
  else
    v_kind := 'left';
  end if;

  insert into public.match_messages (match_id, sender_id, kind)
  values (v_row.match_id, v_row.player_id, v_kind);
  return null;
end;
$$;

revoke all on function public.note_match_player_change() from public, anon, authenticated;

create trigger match_players_note_chat
  after insert or delete on public.match_players
  for each row execute function public.note_match_player_change();

create function public.note_match_change()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if old.status = 'open' and new.status = 'cancelled' then
    insert into public.match_messages (match_id, sender_id, kind)
    values (new.id, new.host_id, 'cancelled');
  elsif old.court_id is null and new.court_id is not null then
    insert into public.match_messages (match_id, sender_id, kind)
    values (new.id, new.host_id, 'court_booked');
  end if;
  return null;
end;
$$;

revoke all on function public.note_match_change() from public, anon, authenticated;

create trigger matches_note_chat
  after update of status, court_id on public.matches
  for each row execute function public.note_match_change();

-- New messages show up without reloading. Realtime applies the read policy above.
alter publication supabase_realtime add table public.match_messages;
