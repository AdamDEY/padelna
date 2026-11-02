-- The send-push Edge Function only runs when the database asks: each wake-up carries a
-- random secret kept in Vault, and the function checks it before sending anything.

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_sender_secret');

-- For the Edge Function (service role), to check the secret it was sent
create function public.push_sender_secret()
  returns text
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'push_sender_secret';
$$;

revoke all on function public.push_sender_secret() from public, anon, authenticated;
grant execute on function public.push_sender_secret() to service_role;

-- Same as before, now with the secret, and usable from both the trigger and the cron job
create function public.call_push_sender()
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://phanktfbxpcyprwcudyb.supabase.co/functions/v1/send-push',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-push-secret', public.push_sender_secret()
    )
  );
end;
$$;

revoke all on function public.call_push_sender() from public, anon, authenticated;

create or replace function public.wake_push_sender()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform public.call_push_sender();
  return null;
end;
$$;

select cron.unschedule('send-waiting-pushes');
select cron.schedule(
  'send-waiting-pushes',
  '* * * * *',
  $$select public.call_push_sender()
    where exists (
      select 1 from public.notification_outbox
      where sent_at is null and created_at > now() - interval '1 day'
    )$$
);
