-- A deciding third set can be played as a super tie-break: first to 10, two clear
-- (10-0 to 10-8, then 11-9, 12-10...). Sets 1 and 2 are still 6-0 to 6-4, 7-5 or 7-6.
create or replace function public.is_valid_padel_score(team1 smallint[], team2 smallint[])
  returns boolean
  language plpgsql
  immutable
  set search_path = ''
as $$
declare
  v_sets int := coalesce(array_length(team1, 1), 0);
  v_team1_sets int := 0;
  v_team2_sets int := 0;
  v_high int;
  v_low int;
begin
  if v_sets not in (2, 3) or coalesce(array_length(team2, 1), 0) <> v_sets then
    return false;
  end if;

  for i in 1..v_sets loop
    if team1[i] is null or team2[i] is null then
      return false;
    end if;
    v_high := greatest(team1[i], team2[i]);
    v_low := least(team1[i], team2[i]);
    if not (
      (v_high = 6 and v_low <= 4)
      or (v_high = 7 and v_low in (5, 6))
      or (i = 3 and v_low >= 0 and ((v_high = 10 and v_low <= 8) or (v_high > 10 and v_high - v_low = 2)))
    ) then
      return false;
    end if;
    -- Nothing is played once a team has won two sets
    if v_team1_sets = 2 or v_team2_sets = 2 then
      return false;
    end if;
    if team1[i] > team2[i] then
      v_team1_sets := v_team1_sets + 1;
    else
      v_team2_sets := v_team2_sets + 1;
    end if;
  end loop;

  return v_team1_sets = 2 or v_team2_sets = 2;
end;
$$;
