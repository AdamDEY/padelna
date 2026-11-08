import { useQuery } from "@tanstack/react-query";

import { fetchUpcomingTournaments } from "@/repositories/tournament-repository";

export const upcomingTournamentsKey = ["tournaments", "upcoming"] as const;

// The admin creates tournaments now and then; a few minutes old is fine
const TOURNAMENTS_STALE_MS = 5 * 60_000;

/** Tournaments open for entries. */
export function useUpcomingTournaments() {
  return useQuery({
    queryKey: upcomingTournamentsKey,
    queryFn: fetchUpcomingTournaments,
    staleTime: TOURNAMENTS_STALE_MS,
  });
}
