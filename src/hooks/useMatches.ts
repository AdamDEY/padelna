import { useMutation, useQuery } from "@tanstack/react-query";

import type { SetScore } from "@/lib/padel-score";
import { queryClient } from "@/lib/query-client";
import {
  cancelMatch,
  confirmScore,
  createMatch,
  fetchClubs,
  fetchMatch,
  fetchMatchPhotoUrl,
  fetchMyPastMatches,
  fetchMyPendingScores,
  fetchMyShareableMatches,
  fetchMyUpcomingMatches,
  fetchOpenMatches,
  joinMatch,
  leaveMatch,
  submitScore,
  uploadMatchPhoto,
} from "@/repositories/match-repository";

// Live updates can fail without any sign (a dropped connection, a phone that was asleep), so
// the lists also reload now and then while they are on screen
const SAFETY_REFETCH_MS = 30_000;

export const clubsKey = ["clubs"] as const;
export const myMatchesKey = ["my-matches"] as const;
// Under myMatchesKey, so anything that reloads your matches reloads your history too
export const pastMatchesKey = [...myMatchesKey, "past"] as const;
export const openMatchesKey = ["open-matches"] as const;
export const matchKey = (id: string) => ["match", id] as const;
// Under myMatchesKey too: a new score or photo changes what can still be shared
export const shareableMatchesKey = [...myMatchesKey, "shareable"] as const;
export const pendingScoresKey = ["pending-scores"] as const;
export const friendsFeedKey = ["friends-feed"] as const;

// Everything a match change can touch: the lists and the match itself (or every match)
export function refreshMatches(matchId?: string) {
  queryClient.invalidateQueries({ queryKey: myMatchesKey });
  queryClient.invalidateQueries({ queryKey: openMatchesKey });
  queryClient.invalidateQueries({ queryKey: pendingScoresKey });
  // A confirmed score or new photo shows up in the Friends feed
  queryClient.invalidateQueries({ queryKey: friendsFeedKey });
  queryClient.invalidateQueries({ queryKey: matchId ? matchKey(matchId) : ["match"] });
}

// Home looks this many days ahead for open matches
const HOME_OPEN_MATCHES_DAYS = 7;
// Keyed by the number of days, not by dates, so the splash screen can load the very same query
export const homeOpenMatchesKey = [...openMatchesKey, "next-days", HOME_OPEN_MATCHES_DAYS] as const;

export function fetchHomeOpenMatches() {
  const from = new Date();
  return fetchOpenMatches(from, new Date(from.getTime() + HOME_OPEN_MATCHES_DAYS * 86_400_000));
}

/** Open matches with a free spot over the next week, for Home. */
export function useHomeOpenMatches() {
  return useQuery({
    queryKey: homeOpenMatchesKey,
    queryFn: fetchHomeOpenMatches,
    refetchInterval: SAFETY_REFETCH_MS,
  });
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

/** Matches you played that are over, most recent first. */
export function useMyPastMatches() {
  return useQuery({
    queryKey: pastMatchesKey,
    queryFn: fetchMyPastMatches,
    refetchInterval: SAFETY_REFETCH_MS,
  });
}

/** Recent matches you hosted that still lack a score or a team photo, for the Community + menu. */
export function useShareableMatches(enabled = true) {
  return useQuery({
    queryKey: shareableMatchesKey,
    queryFn: fetchMyShareableMatches,
    enabled,
  });
}

/** Finished matches whose score you can add or confirm. */
export function usePendingScores() {
  return useQuery({
    queryKey: pendingScoresKey,
    queryFn: fetchMyPendingScores,
    refetchInterval: SAFETY_REFETCH_MS,
  });
}

export function useSubmitScore() {
  return useMutation({
    mutationFn: ({ matchId, sets }: { matchId: string; sets: SetScore[] }) =>
      submitScore(matchId, sets),
    // Refresh on failure too: the other team may have confirmed or corrected it meanwhile
    onSettled: (_, __, { matchId }) => refreshMatches(matchId),
  });
}

export function useConfirmScore() {
  return useMutation({
    mutationFn: confirmScore,
    onSettled: (_, __, matchId) => refreshMatches(matchId),
  });
}

// Signed links last an hour; ask for a new one well before that
const PHOTO_URL_STALE_MS = 45 * 60_000;

/** A link to show a match photo, while it's valid. */
export function useMatchPhotoUrl(path: string | undefined) {
  return useQuery({
    queryKey: ["match-photo", path],
    queryFn: () => fetchMatchPhotoUrl(path!),
    enabled: path !== undefined,
    staleTime: PHOTO_URL_STALE_MS,
    // A missing file won't appear on a retry; fall back to the scoreboard quickly
    retry: 1,
  });
}

export function useUploadMatchPhoto() {
  return useMutation({
    mutationFn: ({ matchId, uri }: { matchId: string; uri: string }) => uploadMatchPhoto(matchId, uri),
    onSettled: (_, __, { matchId }) => refreshMatches(matchId),
  });
}
