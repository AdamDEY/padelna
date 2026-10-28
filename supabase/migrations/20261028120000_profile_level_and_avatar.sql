-- Starting level from the quiz (1-7 scale, half steps) and the profile photo.
alter table public.profiles
  add column level numeric(2, 1) check (level between 1 and 7),
  add column avatar_url text;

-- The quiz result screen isn't built yet, so every player starts at 6 for now.
update public.profiles set level = 6 where level is null;

-- Profile photos are public so other players can see them. Each player writes
-- only inside their own folder: avatars/<user id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Players upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Players replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Players delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Replacing a photo (upsert) reads the existing object first. Public URLs
-- don't need this, so it stays limited to the player's own folder.
create policy "Players read their own avatar"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
