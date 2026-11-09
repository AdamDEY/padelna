-- Saving notification settings has never worked. The app upserts the row, which also writes
-- player_id on conflict, and players could not update that column, so every save was refused and
-- the switches snapped back. The update policy's check still keeps the value to the player's own id.

grant update (player_id) on public.notification_settings to authenticated;
