import { useMutation, useQuery } from "@tanstack/react-query";

import { queryClient } from "@/lib/query-client";
import {
  cancelMatch,
  createMatch,
  fetchClubs,
  fetchMatch,
  fetchMyUpcomingMatches,
} from "@/repositories/match-repository";

export const clubsKey = ["clubs"] as const;
export const myMatchesKey = ["my-matches"] as const;
export const matchKey = (id: string) => ["match", id] as const;

/** Every club with its courts, for choosing where a match is booked. */
export function useClubs() {
  // Clubs change rarely (a CMS adds them), so keep them for the whole session
  return useQuery({ queryKey: clubsKey, queryFn: fetchClubs, staleTime: Infinity });
}

/** One match with its line-up; `enabled` stays off for ids that aren't database matches. */
export function useMatch(id: string, enabled = true) {
  return useQuery({ queryKey: matchKey(id), queryFn: () => fetchMatch(id), enabled });
}

/** Matches you host or play in that haven't finished. */
export function useMyUpcomingMatches() {
  return useQuery({ queryKey: myMatchesKey, queryFn: fetchMyUpcomingMatches });
}

export function useCreateMatch() {
  return useMutation({
    mutationFn: createMatch,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myMatchesKey }),
  });
}

export function useCancelMatch() {
  return useMutation({
    mutationFn: cancelMatch,
    onSuccess: (_, matchId) => {
      queryClient.invalidateQueries({ queryKey: myMatchesKey });
      queryClient.invalidateQueries({ queryKey: matchKey(matchId) });
    },
  });
}
