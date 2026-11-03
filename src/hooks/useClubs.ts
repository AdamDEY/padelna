import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useMyLocation } from "@/hooks/useMyLocation";
import { useUpcomingOpenMatches } from "@/hooks/useMatches";
import { useMyClubs } from "@/hooks/usePlayers";
import { toClubCards } from "@/lib/club";
import { fetchClubs } from "@/repositories/club-repository";
import type { ClubCard } from "@/types/club";

export const clubsKey = ["clubs"] as const;

// The admin dashboard edits clubs now and then; a few minutes old is fine
const CLUBS_STALE_MS = 5 * 60_000;
// Nearby clubs on Home
const NEARBY_LIMIT = 3;

/** Every club players can see, as the database holds it. */
export function useClubs() {
  return useQuery({ queryKey: clubsKey, queryFn: fetchClubs, staleTime: CLUBS_STALE_MS });
}

/**
 * Every club with its open matches, whether it's yours and how far it is. `isLoading` is true
 * until the clubs themselves are in; the rest fills in as it arrives.
 */
export function useClubCards() {
  const { data: clubs, isLoading, error, refetch, isRefetching } = useClubs();
  const { data: openMatches } = useUpcomingOpenMatches();
  const { data: myClubs } = useMyClubs();
  const location = useMyLocation();

  const cards = useMemo<ClubCard[]>(
    () =>
      toClubCards(
        clubs ?? [],
        openMatches ?? [],
        new Set((myClubs ?? []).map((club) => club.id)),
        location ?? undefined,
      ),
    [clubs, openMatches, myClubs, location],
  );

  // Distances need the player's location and clubs with a map pin
  const hasDistances = cards.some((club) => club.distanceKm !== undefined);

  // Clubs already shown stay up when a later reload fails, so only a first load counts as failed
  return { clubs: cards, isLoading, error: clubs ? null : error, refetch, isRefetching, hasDistances };
}

/** One club by id, or undefined while loading or when there is no such club. */
export function useClubCard(id: string | undefined) {
  const { clubs, ...rest } = useClubCards();
  return { club: clubs.find((club) => club.id === id), ...rest };
}

/** Clubs a player can book a match at: open for new matches, with their switched-on courts. */
export function useBookableClubs() {
  const { data } = useClubs();
  return useMemo(
    () =>
      (data ?? [])
        .filter((club) => club.status === "published")
        .map((club) => ({ ...club, courts: club.courts.filter((court) => court.active) })),
    [data],
  );
}

/** The few clubs Home shows: the closest ones, or the busiest when the location isn't shared. */
export function useNearbyClubs() {
  const { clubs, hasDistances, ...rest } = useClubCards();
  const nearby = useMemo(() => {
    const open = clubs.filter((club) => club.status === "published");
    // Without distances, show the clubs with the most matches to join
    const sorted = hasDistances
      ? open
          .filter((club) => club.distanceKm !== undefined)
          .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      : [...open].sort((a, b) => b.openMatchCount - a.openMatchCount || a.name.localeCompare(b.name));
    return sorted.slice(0, NEARBY_LIMIT);
  }, [clubs, hasDistances]);
  return { clubs: nearby, hasDistances, ...rest };
}
