import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import { communityFeedKey } from "@/hooks/useMatches";
import { notificationsKey } from "@/hooks/useNotifications";
import { useMyAccount } from "@/hooks/useMyProfile";
import { partnerOf, recapOf, type HistoryItem } from "@/lib/tournament-history";
import {
  fetchPartnerCandidates,
  fetchMyTournamentHistory,
  fetchTournament,
  fetchTournamentLive,
  fetchTournaments,
  joinTournament,
  joinTournamentPartnerList,
  leaveTournament,
  postTournamentResult,
  joinTournamentSolo,
  respondToTournamentInvite,
  submitAmericanoScore,
  submitTournamentScore,
} from "@/repositories/tournament-repository";
import type { TournamentScore } from "@/types/tournament";

/** Everything about tournaments: the list, each tournament and its partner candidates */
export const tournamentsKey = ["tournaments"] as const;

// Spots fill up, but not by the second; pull to refresh and any write here reload sooner
const TOURNAMENTS_STALE_MS = 60_000;

export function useTournaments() {
  return useQuery({
    queryKey: [...tournamentsKey, "list"],
    queryFn: fetchTournaments,
    staleTime: TOURNAMENTS_STALE_MS,
  });
}

export function useTournament(id: string) {
  return useQuery({
    queryKey: [...tournamentsKey, "detail", id],
    queryFn: () => fetchTournament(id),
    staleTime: TOURNAMENTS_STALE_MS,
  });
}

/** Loads when the partner sheet opens. */
export function usePartnerCandidates(tournamentId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...tournamentsKey, "partners", tournamentId],
    queryFn: () => fetchPartnerCandidates(tournamentId),
    enabled,
    staleTime: 0,
  });
}

function useRefreshAfter<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => {
      // Answering an invite removes its notification
      queryClient.invalidateQueries({ queryKey: notificationsKey });
      return queryClient.invalidateQueries({ queryKey: tournamentsKey });
    },
  });
}

export function useJoinTournament() {
  return useRefreshAfter(({ tournamentId, partnerId }: { tournamentId: string; partnerId: string }) =>
    joinTournament(tournamentId, partnerId),
  );
}

export function useJoinTournamentPartnerList() {
  return useRefreshAfter(joinTournamentPartnerList);
}

export function useRespondToTournamentInvite() {
  return useRefreshAfter(({ entryId, accept }: { entryId: string; accept: boolean }) =>
    respondToTournamentInvite(entryId, accept),
  );
}

export function useLeaveTournament() {
  return useRefreshAfter(leaveTournament);
}

// Scores come in through the day; a live tournament checks again this often while it's open
const LIVE_REFRESH_MS = 30_000;

/** Groups, matches and the bracket of a live tournament. */
export function useTournamentLive(id: string | undefined) {
  return useQuery({
    queryKey: [...tournamentsKey, "live", id],
    queryFn: () => fetchTournamentLive(id as string),
    enabled: !!id,
    staleTime: LIVE_REFRESH_MS,
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export function useSubmitTournamentScore() {
  return useRefreshAfter(({ matchId, score }: { matchId: string; score: TournamentScore }) =>
    submitTournamentScore(matchId, score),
  );
}

export function useJoinTournamentSolo() {
  return useRefreshAfter(joinTournamentSolo);
}

export function useSubmitAmericanoScore() {
  return useRefreshAfter(({ matchId, score }: { matchId: string; score: TournamentScore }) =>
    submitAmericanoScore(matchId, score),
  );
}

// A finished tournament never changes, so what was loaded stays good for a while
const FINISHED_STALE_MS = 5 * 60_000;

/** Just the list of finished tournaments I played, for the Profile's count. */
export function useMyFinishedTournaments() {
  return useQuery({
    queryKey: [...tournamentsKey, "history"],
    queryFn: fetchMyTournamentHistory,
    staleTime: TOURNAMENTS_STALE_MS,
  });
}

/**
 * The finished tournaments I played, newest first, each with what I did in it (design "Tournament
 * history"). `items` stays undefined until the list and every recap behind it have loaded.
 */
export function useTournamentHistory() {
  const myId = useMyAccount().data?.id;
  const list = useMyFinishedTournaments();
  // Same keys as useTournamentLive, so opening a recap finds its data already loaded
  const lives = useQueries({
    queries: (list.data ?? []).map((summary) => ({
      queryKey: [...tournamentsKey, "live", summary.id],
      queryFn: () => fetchTournamentLive(summary.id),
      staleTime: FINISHED_STALE_MS,
    })),
  });

  const error = list.error ?? lives.find((live) => live.error)?.error ?? null;
  const isReady = list.data !== undefined && lives.every((live) => live.data !== undefined);
  const items = isReady
    ? (list.data ?? []).flatMap((summary, index): HistoryItem[] => {
        const tournament = lives[index].data;
        // A tournament that was removed since has nothing to show
        if (!tournament) return [];
        return [{ summary, tournament, recap: recapOf(tournament, myId), partner: partnerOf(tournament, myId) }];
      })
    : undefined;

  return {
    items,
    error,
    isRefetching: list.isRefetching || lives.some((live) => live.isRefetching),
    refetch: () => Promise.all([list.refetch(), ...lives.map((live) => live.refetch())]),
  };
}

/** A finished tournament as it was played, for a Community post; it never changes, so no refresh. */
export function useFinishedTournament(id: string) {
  return useQuery({
    queryKey: [...tournamentsKey, "live", id],
    queryFn: () => fetchTournamentLive(id),
    staleTime: FINISHED_STALE_MS,
  });
}

/** Posts my result of a finished tournament to the Community feeds. */
export function usePostTournamentResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tournamentId, caption }: { tournamentId: string; caption?: string }) =>
      postTournamentResult(tournamentId, caption),
    // The new post shows in the feeds right away
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communityFeedKey }),
  });
}
