import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryClient } from "@/lib/query-client";
import {
  CHAT_PAGE_SIZE,
  fetchMatchChatUnreadCount,
  fetchMatchMessages,
  markMatchChatRead,
  sendMatchMessage,
  subscribeToMatchMessages,
} from "@/repositories/chat-repository";

// Live updates can fail without any sign, so the unread dot also checks now and then
const UNREAD_REFETCH_MS = 30_000;

export const matchChatKey = (matchId: string) => ["match-chat", matchId] as const;
const unreadKey = (matchId: string) => [...matchChatKey(matchId), "unread"] as const;

function refreshChat(matchId: string) {
  queryClient.invalidateQueries({ queryKey: matchChatKey(matchId) });
}

/** A match's chat, newest first, a page at a time; it reloads as messages arrive while it's open. */
export function useMatchMessages(matchId: string) {
  useEffect(() => subscribeToMatchMessages(matchId, "messages", () => refreshChat(matchId)), [matchId]);

  return useInfiniteQuery({
    queryKey: [...matchChatKey(matchId), "messages"],
    queryFn: ({ pageParam }) => fetchMatchMessages(matchId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length < CHAT_PAGE_SIZE ? undefined : lastPage[lastPage.length - 1].createdAt.toISOString(),
  });
}

export function useSendMatchMessage() {
  return useMutation({
    mutationFn: ({ matchId, body }: { matchId: string; body: string }) => sendMatchMessage(matchId, body),
    onSettled: (_, __, { matchId }) => refreshChat(matchId),
  });
}

export function useMarkMatchChatRead() {
  return useMutation({
    mutationFn: markMatchChatRead,
    // Refetch rather than set 0: this cancels a count that started before the read was saved
    onSuccess: (_, matchId) => queryClient.invalidateQueries({ queryKey: unreadKey(matchId) }),
  });
}

/** How many messages arrived since you last opened the chat, for the dot on the Group chat button. */
export function useMatchChatUnreadCount(matchId: string, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    return subscribeToMatchMessages(matchId, "unread", () =>
      queryClient.invalidateQueries({ queryKey: unreadKey(matchId) }),
    );
  }, [matchId, enabled]);

  return useQuery({
    queryKey: unreadKey(matchId),
    queryFn: () => fetchMatchChatUnreadCount(matchId),
    enabled,
    refetchInterval: UNREAD_REFETCH_MS,
  });
}
