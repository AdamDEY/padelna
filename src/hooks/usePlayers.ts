import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

import { queryClient } from "@/lib/query-client";
import { onSignedInChange } from "@/repositories/auth-repository";
import {
  fetchConnectionRequests,
  fetchMyClubs,
  fetchPlayerDetails,
  fetchPlayedWith,
  fetchPlayersAtMyClubs,
  requestConnection,
  respondToConnection,
  searchPlayers,
  subscribeToConnectionChanges,
} from "@/repositories/player-repository";
import type { PlayerSuggestion } from "@/types/player";

// Search waits for this many characters, like the database
const MIN_SEARCH_LENGTH = 2;

export const playersKey = ["players"] as const;
export const connectionRequestsKey = [...playersKey, "requests"] as const;

// Every list on the Players screen shows connection states, so a change reloads them all
function refreshPlayers() {
  // The Friends feed shows who's a friend, so it changes with connections too
  void queryClient.invalidateQueries({ queryKey: ["friends-feed"] });
  return queryClient.invalidateQueries({ queryKey: playersKey });
}

export function useMyClubs() {
  return useQuery({ queryKey: [...playersKey, "my-clubs"], queryFn: fetchMyClubs });
}

export function usePlayedWith() {
  return useQuery({ queryKey: [...playersKey, "played-with"], queryFn: fetchPlayedWith });
}

export function usePlayersAtMyClubs() {
  return useQuery({ queryKey: [...playersKey, "at-my-clubs"], queryFn: fetchPlayersAtMyClubs });
}

export function useConnectionRequests() {
  return useQuery({ queryKey: connectionRequestsKey, queryFn: fetchConnectionRequests });
}

/** Players matching `query`; stays idle until it has 2 characters. */
export function useSearchPlayers(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: [...playersKey, "search", trimmed],
    queryFn: () => searchPlayers(trimmed),
    enabled: trimmed.length >= MIN_SEARCH_LENGTH,
    // Keep the last results on screen while the next ones load
    placeholderData: (previous) => previous,
  });
}

export function useRequestConnection() {
  return useMutation({ mutationFn: requestConnection, onSettled: refreshPlayers });
}

export function useRespondToConnection() {
  return useMutation({
    mutationFn: ({ playerId, accept }: { playerId: string; accept: boolean }) =>
      respondToConnection(playerId, accept),
    onSettled: refreshPlayers,
  });
}

/**
 * Reloads the Players lists and the requests banner on Home when a request arrives or is
 * answered, while signed in. Call it once, near the root.
 */
export function useConnectionsRealtime() {
  useEffect(() => {
    let stopListening: (() => void) | undefined;

    const stopWatchingAuth = onSignedInChange((isSignedIn) => {
      stopListening?.();
      stopListening = isSignedIn ? subscribeToConnectionChanges(() => void refreshPlayers()) : undefined;
    });

    return () => {
      stopWatchingAuth();
      stopListening?.();
    };
  }, []);
}

export function usePlayerDetails(playerId: string | undefined) {
  return useQuery({
    queryKey: [...playersKey, "details", playerId],
    queryFn: () => fetchPlayerDetails(playerId!),
    enabled: playerId !== undefined,
  });
}

/**
 * The player as the lists now know them. A sheet keeps the player it was opened with,
 * so this picks up a connection that changed since (Connect pressed, request accepted).
 */
export function useFreshPlayer(player: PlayerSuggestion | undefined) {
  return useSyncExternalStore(
    (onChange) => queryClient.getQueryCache().subscribe(onChange),
    () => {
      if (!player) return undefined;
      // Several lists can hold the same player; the one loaded last is right
      let latest = { player, at: 0 };
      for (const query of queryClient.getQueryCache().findAll({ queryKey: playersKey })) {
        const list = Array.isArray(query.state.data) ? (query.state.data as unknown[]) : [];
        const found = list.find(
          (item): item is PlayerSuggestion =>
            typeof item === "object" &&
            item !== null &&
            "connection" in item &&
            (item as PlayerSuggestion).id === player.id,
        );
        if (found && query.state.dataUpdatedAt > latest.at) latest = { player: found, at: query.state.dataUpdatedAt };
      }
      return latest.player;
    },
  );
}
