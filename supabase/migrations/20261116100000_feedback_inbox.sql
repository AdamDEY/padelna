-- Admin dashboard "Feedback" inbox for what players send by shaking their phone (app_feedback).
-- Each message gets a ticket number (FB-0482) and a status the admin moves it through:
-- new (never opened) -> open (the admin looked at it) -> done.

alter table public.app_feedback
  add column number bigint generated always as identity,
  add column status text not null default 'new' check (status in ('new', 'open', 'done')),
  add column opened_at timestamptz,
  add column done_at timestamptz;

create unique index app_feedback_number_idx on public.app_feedback (number);
create index app_feedback_status_idx on public.app_feedback (status, created_at desc);

-- Opening a message marks it as seen. Not written to the audit log: reading isn't a change worth
-- recording, and it happens on every click.
create function public.admin_open_feedback(p_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform public.assert_admin();

  update public.app_feedback
  set status = 'open', opened_at = now()
  where id = p_id and status = 'new';
end;
$$;

revoke all on function public.admin_open_feedback(uuid) from public, anon;
grant execute on function public.admin_open_feedback(uuid) to authenticated;

-- Mark a message as done, or bring it back (p_done = false).
create function public.admin_set_feedback_done(p_id uuid, p_done boolean)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_status text;
  v_next text;
begin
  perform public.assert_admin();

  select status into v_status from public.app_feedback where id = p_id for update;
  if not found then
    raise exception 'This feedback no longer exists';
  end if;

  v_next := case when p_done then 'done' else 'open' end;
  if v_status = v_next then
    return;
  end if;

  update public.app_feedback
  set status = v_next,
      done_at = case when p_done then now() else null end,
      opened_at = coalesce(opened_at, now())
  where id = p_id;

  perform public.log_admin_action(
    case when p_done then 'feedback_done' else 'feedback_reopen' end,
    'feedback', p_id::text,
    jsonb_build_object('status', v_status),
    jsonb_build_object('status', v_next),
    null
  );
end;
$$;

revoke all on function public.admin_set_feedback_done(uuid, boolean) from public, anon;
grant execute on function public.admin_set_feedback_done(uuid, boolean) to authenticated;
