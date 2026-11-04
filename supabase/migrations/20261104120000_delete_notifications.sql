-- Players can delete their own notifications (swipe a row to the left in the app).
-- The realtime publication already covers the table, so other open screens see it go.

grant delete on public.notifications to authenticated;

create policy "Players delete their notifications"
  on public.notifications for delete to authenticated
  using ((select auth.uid()) = player_id);
