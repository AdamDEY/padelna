import { supabase } from "@/lib/supabase";
import type { TournamentCategory, UpcomingTournament } from "@/types/tournament";

type TournamentRow = {
  id: string;
  name: string;
  category: TournamentCategory;
  starts_at: string | null;
  club_name: string | null;
};

/** Tournaments open for entries, soonest first. */
export async function fetchUpcomingTournaments(): Promise<UpcomingTournament[]> {
  const { data, error } = await supabase.rpc("get_upcoming_tournaments");
  if (error) throw error;
  return (data as TournamentRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    startsAt: row.starts_at ? new Date(row.starts_at) : undefined,
    clubName: row.club_name ?? undefined,
  }));
}
