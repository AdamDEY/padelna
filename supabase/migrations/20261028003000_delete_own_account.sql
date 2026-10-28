-- Lets a signed-in player delete their own account. The app can't use the
-- admin API (it needs the secret key), so this runs with the owner's rights
-- and only ever touches the caller's row. Deleting the auth user cascades to
-- public.profiles.
create function public.delete_own_account()
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
