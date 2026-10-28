-- Lets the app hear about joins, leaves and cancellations as they happen.
-- Realtime applies the same row-level security as normal reads.
alter publication supabase_realtime add table public.matches, public.match_players;
