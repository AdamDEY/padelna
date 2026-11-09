import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notificationsKey } from "@/hooks/useNotifications";
import {
  fetchPartnerCandidates,
  fetchTournament,
  fetchTournamentLive,
  fetchTournaments,
  joinTournament,
  joinTournamentPartnerList,
  leaveTournament,
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
