import { useMutation, useQuery } from "@tanstack/react-query";

import { queryClient } from "@/lib/query-client";
import {
  cancelMatch,
  createMatch,
  fetchClubs,
  fetchMatch,
  fetchMyUpcomingMatches,
  fetchOpenMatches,
  joinMatch,
  leaveMatch,
} from "@/repositories/match-repository";

// Live updates can fail without any sign (a dropped connection, a phone that was asleep), so
// the lists also reload now and then while they are on screen
const SAFETY_REFETCH_MS = 30_000;

export const clubsKey = ["clubs"] as const;
export const myMatchesKey = ["my-matches"] as const;
export const openMatchesKey = ["open-matches"] as const;
export const matchKey = (id: string) => ["match", id] as const;

// Everything a match change can touch: the lists and the match itself (or every match)
export function refreshMatches(matchId?: string) {
  queryClient.invalidateQueries({ queryKey: myMatchesKey });
  queryClient.invalidateQueries({ queryKey: openMatchesKey });
  queryClient.invalidateQueries({ queryKey: matchId ? matchKey(matchId) : ["match"] });
}

/** Every club with its courts, for choosing where a match is booked. */
export function useClubs() {
  // Clubs change rarely (a CMS adds them), so keep them for the whole session
  return useQuery({ queryKey: clubsKey, queryFn: fetchClubs, staleTime: Infinity });
}

/** One match with its line-up; `enabled` stays off for ids that aren't database matches. */
export function useMatch(id: string, enabled = true) {
  return useQuery({ queryKey: matchKey(id), queryFn: () => fetchMatch(id), enabled });
}

/** Open matches with a free spot that start between `from` and `to`. */
export function useOpenMatches(from: Date, to: Date) {
  return useQuery({
    queryKey: [...openMatchesKey, from.toISOString(), to.toISOString()],
    queryFn: () => fetchOpenMatches(from, to),
    refetchInterval: SAFETY_REFETCH_MS,
  });
}

/** Matches you host or play in that haven't finished. */
export function useMyUpcomingMatches() {
  return useQuery({
    queryKey: myMatchesKey,
    queryFn: fetchMyUpcomingMatches,
    refetchInterval: SAFETY_REFETCH_MS,
  });
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
    onSuccess: (_, matchId) => refreshMatches(matchId),
  });
}

export function useJoinMatch() {
  return useMutation({
    mutationFn: ({ matchId, seat }: { matchId: string; seat: number }) => joinMatch(matchId, seat),
    onSuccess: (_, { matchId }) => refreshMatches(matchId),
    // Someone may have taken the seat meanwhile, so show what the match looks like now
    onError: (_, { matchId }) => refreshMatches(matchId),
  });
}

export function useLeaveMatch() {
  return useMutation({
    mutationFn: leaveMatch,
    onSuccess: (_, matchId) => refreshMatches(matchId),
  });
}
