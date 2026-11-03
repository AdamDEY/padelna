import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { communityFeedKey, friendsFeedKey } from "@/hooks/useMatches";
import {
  fetchClubsFeed,
  fetchClubsWeek,
  fetchCommunityCities,
  fetchFriendsFeed,
  fetchRisingPlayers,
  fetchTunisiaFeed,
} from "@/repositories/feed-repository";
import type { FeedMatch } from "@/types/post";

// Matches per page of the feed
const PAGE_SIZE = 20;

/** One feed, a page at a time; `fetchPage` gets the last page's oldest confirmation. */
function useFeedPages(
  queryKey: readonly unknown[],
  fetchPage: (before: Date | undefined, limit: number) => Promise<FeedMatch[]>,
) {
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam, PAGE_SIZE),
    initialPageParam: undefined as Date | undefined,
    // A short page means there's nothing older
    getNextPageParam: (lastPage) =>
      lastPage.length < PAGE_SIZE ? undefined : lastPage[lastPage.length - 1].confirmedAt,
  });
}

/** Confirmed matches where you or a friend played, newest first, a page at a time. */
export function useFriendsFeed() {
  return useFeedPages(friendsFeedKey, fetchFriendsFeed);
}

/** Confirmed matches at your clubs, or at the club with `clubId`. */
export function useClubsFeed(clubId?: string) {
  return useFeedPages([...communityFeedKey, "clubs", clubId ?? null], (before, limit) =>
    fetchClubsFeed(clubId, before, limit),
  );
}

/** Confirmed matches anywhere in Tunisia, or in `city`. */
export function useTunisiaFeed(city?: string) {
  return useFeedPages([...communityFeedKey, "tunisia", city ?? null], (before, limit) =>
    fetchTunisiaFeed(city, before, limit),
  );
}

export function useCommunityCities() {
  return useQuery({ queryKey: [...communityFeedKey, "cities"], queryFn: fetchCommunityCities });
}

export function useClubsWeek() {
  return useQuery({ queryKey: [...communityFeedKey, "clubs-week"], queryFn: fetchClubsWeek });
}

export function useRisingPlayers() {
  return useQuery({ queryKey: [...communityFeedKey, "rising"], queryFn: () => fetchRisingPlayers() });
}
