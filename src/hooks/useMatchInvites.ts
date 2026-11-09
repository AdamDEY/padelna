import { useMutation, useQuery } from "@tanstack/react-query";

import { myMatchesKey, refreshMatches } from "@/hooks/useMatches";
import { notificationsKey } from "@/hooks/useNotifications";
import { queryClient } from "@/lib/query-client";
import {
  cancelMatchInvite,
  fetchMyMatchInvites,
  invitePlayerToMatch,
  respondToMatchInvite,
} from "@/repositories/match-invite-repository";

// Under myMatchesKey, so anything that reloads your matches reloads your invitations too
export const myMatchInvitesKey = [...myMatchesKey, "invites"] as const;

// Live updates can fail without any sign, so the list also reloads now and then
const SAFETY_REFETCH_MS = 30_000;

// An answered or taken-back invitation also changes the match, the lists and the bell
function refreshAfterInviteChange(matchId: string) {
  refreshMatches(matchId);
  queryClient.invalidateQueries({ queryKey: notificationsKey });
}

/** Invitations from hosts that wait for your answer. */
export function useMyMatchInvites() {
  return useQuery({
    queryKey: myMatchInvitesKey,
    queryFn: fetchMyMatchInvites,
    refetchInterval: SAFETY_REFETCH_MS,
  });
}

/** The host adds a player to an open seat. */
export function useInvitePlayer() {
  return useMutation({
    mutationFn: ({ matchId, seat, playerId }: { matchId: string; seat: number; playerId: string }) =>
      invitePlayerToMatch(matchId, seat, playerId),
    // Even a refusal means the match changed meanwhile (the seat was taken), so reload it
    onSettled: (_, __, { matchId }) => refreshAfterInviteChange(matchId),
  });
}

/** The invited player accepts (takes the seat) or declines. */
export function useRespondToMatchInvite() {
  return useMutation({
    mutationFn: ({ inviteId, accept }: { inviteId: string; matchId: string; accept: boolean }) =>
      respondToMatchInvite(inviteId, accept),
    onSettled: (_, __, { matchId }) => refreshAfterInviteChange(matchId),
  });
}

/** The host takes back an invitation that wasn't answered. */
export function useCancelMatchInvite() {
  return useMutation({
    mutationFn: ({ inviteId }: { inviteId: string; matchId: string }) => cancelMatchInvite(inviteId),
    onSettled: (_, __, { matchId }) => refreshAfterInviteChange(matchId),
  });
}
