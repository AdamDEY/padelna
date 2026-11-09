-- A player's latest coach evaluation, for the "Coach verified" badge and summary on their profile.
-- Evaluations are admin-only to read, so players get this narrow, signed-in-only view instead.
-- The coach's written comment is only returned to the player it is about.
create function public.get_coach_verification(p_player_id uuid)
  returns table (
    coach_name text,
    level numeric,
    scores jsonb,
    comment text,
    evaluated_at timestamptz
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select
    e.coach_name,
    e.level,
    e.scores,
    case when e.player_id = (select auth.uid()) then e.comment else '' end,
    e.created_at
  from public.coach_evaluations e
  where e.player_id = p_player_id and (select auth.uid()) is not null
  order by e.created_at desc
  limit 1;
$$;

revoke all on function public.get_coach_verification(uuid) from public, anon;
grant execute on function public.get_coach_verification(uuid) to authenticated;
