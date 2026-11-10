-- A club's logo, shown on its cards in the app. Managed from the admin dashboard.
-- The bucket is public so the app can use plain URLs; files live at club-logos/<club id>/...
alter table public.clubs add column logo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-logos', 'club-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Admins upload club logos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'club-logos' and (select public.is_admin()));

create policy "Admins delete club logos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'club-logos' and (select public.is_admin()));

-- Sets the club's logo to a file the dashboard just uploaded, or clears it when p_file_path
-- is null. Returns the previous file so the dashboard can remove it.
create function public.admin_set_club_logo(p_club_id text, p_file_path text)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_old text;
begin
  perform public.assert_admin();

  if p_file_path is not null and split_part(p_file_path, '/', 1) <> p_club_id then
    raise exception 'That logo doesn''t belong to this club';
  end if;

  select logo_path into v_old from public.clubs where id = p_club_id for update;
  if not found then
    raise exception 'This club no longer exists';
  end if;

  update public.clubs set logo_path = p_file_path, updated_at = now() where id = p_club_id;

  perform public.log_admin_action(
    case when p_file_path is null then 'remove_club_logo' else 'set_club_logo' end,
    'club', p_club_id,
    jsonb_build_object('logo_path', v_old),
    jsonb_build_object('logo_path', p_file_path),
    null
  );
  return v_old;
end;
$$;

revoke all on function public.admin_set_club_logo(text, text) from public, anon;
grant execute on function public.admin_set_club_logo(text, text) to authenticated;
