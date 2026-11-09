-- The host check in 20261109200000_match_audience.sql never ran: the function is security
-- definer, so current_user inside it is the owner and the "admin tools skip" always fired.
-- A men or women match now always needs a host of that gender.
create or replace function public.check_match_audience()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if new.audience = 'mixed' then
    return new;
  end if;
  if (select gender from public.profiles where id = new.host_id)
     is distinct from (case new.audience when 'men' then 'male' else 'female' end) then
    raise exception 'You can only host a match for your own gender';
  end if;
  return new;
end;
$$;
