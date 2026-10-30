-- Team photo of a finished match. The host adds it with the score. Only the
-- match's 4 players can see it: the bucket is private and the app shows the
-- photo through short-lived signed URLs. Files live at match-photos/<match id>/...

alter table public.match_scores add column photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('match-photos', 'match-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- The host uploads into the match's folder
create policy "Hosts upload their match photo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'match-photos'
    and exists (
      select 1 from public.matches m
      where m.id::text = (storage.foldername(name))[1]
        and m.host_id = (select auth.uid())
    )
  );

-- Players in the match can read it (signed URLs need this)
create policy "Players read their match photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'match-photos'
    and exists (
      select 1 from public.match_players mp
      where mp.match_id::text = (storage.foldername(name))[1]
        and mp.player_id = (select auth.uid())
    )
  );

-- Saves which uploaded file is the match's photo. Host only, once the score exists,
-- and only a file inside that match's folder.
create function public.set_match_photo(p_match_id uuid, p_path text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in first';
  end if;
  if not exists (select 1 from public.matches where id = p_match_id and host_id = v_uid) then
    raise exception 'Only the host can add the team photo';
  end if;
  if p_path is null or split_part(p_path, '/', 1) <> p_match_id::text then
    raise exception 'That photo doesn''t belong to this match';
  end if;

  update public.match_scores set photo_path = p_path where match_id = p_match_id;
  if not found then
    raise exception 'Add the score first';
  end if;
end;
$$;

revoke all on function public.set_match_photo(uuid, text) from public, anon;
grant execute on function public.set_match_photo(uuid, text) to authenticated;
