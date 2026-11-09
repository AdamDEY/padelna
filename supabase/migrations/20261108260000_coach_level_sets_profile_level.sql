-- A coach evaluation now sets the player's level (the coach level overrides the quiz level).
-- The normal triggers do the rest: level_history gets a row, and level_points resets to the
-- new level (sync_level_points). The history row needs its own cause, 'coach'.
alter table public.level_history drop constraint level_history_cause_check;
alter table public.level_history
  add constraint level_history_cause_check check (cause in ('quiz', 'match', 'admin', 'coach'));

create or replace function public.record_level_change()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_cause text := coalesce(current_setting('padelna.level_cause', true), '');
begin
  insert into public.level_history (player_id, old_level, new_level, cause, match_id)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.level end,
    new.level,
    case
      when tg_op = 'INSERT' or old.level is null then 'quiz'
      when v_cause = 'match' then 'match'
      when v_cause = 'coach' then 'coach'
      else 'admin'
    end,
    case when v_cause = 'match' then nullif(current_setting('padelna.level_match_id', true), '')::uuid end
  );
  return null;
end;
$$;

create or replace function public.admin_add_coach_evaluation(
  p_player_id uuid, p_coach_name text, p_scores jsonb, p_level numeric, p_comment text
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_coach_name, ''));
  v_comment text := btrim(coalesce(p_comment, ''));
  v_prev numeric;
  v_key text;
  v_val jsonb;
begin
  perform public.assert_admin();

  if v_name = '' then
    raise exception 'Enter the coach''s name';
  end if;
  if char_length(v_name) > 80 then
    raise exception 'The coach''s name can be up to 80 characters';
  end if;
  if char_length(v_comment) > 1000 then
    raise exception 'The comment can be up to 1000 characters';
  end if;
  if p_level is null or p_level < 1 or p_level > 7 or p_level <> round(p_level, 1) then
    raise exception 'The level must be from 1.0 to 7.0, in steps of 0.1';
  end if;
  if p_scores is null or jsonb_typeof(p_scores) <> 'object' or p_scores = '{}'::jsonb then
    raise exception 'Score at least one skill';
  end if;

  for v_key, v_val in select * from jsonb_each(p_scores) loop
    if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}')::numeric not between 1 and 5
       or (v_val #>> '{}')::numeric <> round((v_val #>> '{}')::numeric) then
      raise exception 'Scores must be whole numbers from 1 to 5';
    end if;
  end loop;

  select level into v_prev from public.profiles where id = p_player_id for update;
  if not found then
    raise exception 'This player no longer exists';
  end if;

  insert into public.coach_evaluations (player_id, coach_name, scores, level, previous_level, comment, created_by)
  values (p_player_id, v_name, p_scores, p_level, v_prev, v_comment, auth.uid());

  -- The coach's level becomes the player's level; the history row is tagged 'coach'
  perform set_config('padelna.level_cause', 'coach', true);
  update public.profiles set level = p_level where id = p_player_id;
  perform set_config('padelna.level_cause', '', true);

  perform public.log_admin_action(
    'add_coach_evaluation', 'player', p_player_id::text,
    null,
    jsonb_build_object('coach_name', v_name, 'level', p_level, 'scores', p_scores),
    null
  );
end;
$$;
