-- Take back a connection request you sent, or remove a player you're connected to.
--
-- Declining a request someone sent you stays in respond_to_connection. Either
-- player can remove an accepted connection; only the sender can cancel a pending one.

create function public.remove_connection(p_player_id uuid)
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

  delete from public.connections
  where least(requester_id, addressee_id) = least(v_uid, p_player_id)
    and greatest(requester_id, addressee_id) = greatest(v_uid, p_player_id)
    and (status = 'accepted' or requester_id = v_uid);
  if not found then
    raise exception 'There is no connection to remove';
  end if;
end;
$$;

revoke all on function public.remove_connection(uuid) from public, anon;
grant execute on function public.remove_connection(uuid) to authenticated;
