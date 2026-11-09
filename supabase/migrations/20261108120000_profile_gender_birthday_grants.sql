-- profiles uses column-level grants, so the new columns need their own or every
-- profile save is rejected with 403 (setup could not finish).
grant insert (gender, birth_date), update (gender, birth_date)
  on public.profiles to authenticated;
