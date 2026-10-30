import { useInfiniteQuery } from "@tanstack/react-query";

import { friendsFeedKey } from "@/hooks/useMatches";
import { fetchFriendsFeed } from "@/repositories/feed-repository";

// Matches per page of the feed
const PAGE_SIZE = 20;

/** Confirmed matches where you or a friend played, newest first, a page at a time. */
export function useFriendsFeed() {
  return useInfiniteQuery({
    queryKey: friendsFeedKey,
    queryFn: ({ pageParam }) => fetchFriendsFeed(pageParam, PAGE_SIZE),
    initialPageParam: undefined as Date | undefined,
    // A short page means there's nothing older
    getNextPageParam: (lastPage) =>
      lastPage.length < PAGE_SIZE ? undefined : lastPage[lastPage.length - 1].confirmedAt,
  });
}
