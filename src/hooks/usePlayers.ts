import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryClient } from "@/lib/query-client";
import {
  fetchConnectionRequests,
  fetchMyClubs,
  fetchPlayedWith,
  fetchPlayersAtMyClubs,
  requestConnection,
  respondToConnection,
  searchPlayers,
  subscribeToConnectionChanges,
} from "@/repositories/player-repository";

// Search waits for this many characters, like the database
const MIN_SEARCH_LENGTH = 2;

export const playersKey = ["players"] as const;

// Every list on the Players screen shows connection states, so a change reloads them all
function refreshPlayers() {
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
  return useQuery({ queryKey: [...playersKey, "requests"], queryFn: fetchConnectionRequests });
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

/** Reloads the Players lists when a request arrives or is answered, while the screen is open. */
export function useConnectionsRealtime() {
  useEffect(() => subscribeToConnectionChanges(() => void refreshPlayers()), []);
}
