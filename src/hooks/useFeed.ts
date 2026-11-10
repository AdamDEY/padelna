import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { communityFeedKey, friendsFeedKey } from "@/hooks/useMatches";
import {
  fetchClubsFeed,
  fetchClubsTournamentPosts,
  fetchClubsWeek,
  fetchCommunityCities,
  fetchFriendsFeed,
  fetchFriendsTournamentPosts,
  fetchRisingPlayers,
  fetchTunisiaFeed,
  fetchTunisiaTournamentPosts,
} from "@/repositories/feed-repository";
import type { FeedItem, FeedMatch, FeedPage, FeedTournamentPost } from "@/types/post";

// Matches per page of the feed
const PAGE_SIZE = 20;

type Fetcher<T> = (before: Date | undefined, limit: number) => Promise<T[]>;

/**
 * One page of a feed: matches and tournament posts, newest first. Each kind is paged by its own
 * date, so a kind that returned a full page may still have older ones than its last; nothing older
 * than the newest of those "last" dates is shown yet, and the next page starts from there.
 */
async function fetchMixedPage(
  before: Date | undefined,
  limit: number,
  fetchMatches: Fetcher<FeedMatch>,
  fetchPosts: Fetcher<FeedTournamentPost>,
): Promise<FeedPage> {
  const [matches, posts] = await Promise.all([fetchMatches(before, limit), fetchPosts(before, limit)]);
  const items: FeedItem[] = [
    ...matches.map((match): FeedItem => ({ kind: "match", at: match.confirmedAt, match })),
    ...posts.map((post): FeedItem => ({ kind: "tournament", at: post.postedAt, post })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const horizons = [
    matches.length >= limit ? matches[matches.length - 1].confirmedAt : undefined,
    posts.length >= limit ? posts[posts.length - 1].postedAt : undefined,
  ].filter((date) => date !== undefined);
  if (horizons.length === 0) return { items };

  const horizon = new Date(Math.max(...horizons.map((date) => date.getTime())));
  return { items: items.filter((item) => item.at >= horizon), next: horizon };
}

/** One feed, a page at a time; the next page starts where the last one ended. */
function useFeedPages(queryKey: readonly unknown[], fetchMatches: Fetcher<FeedMatch>, fetchPosts: Fetcher<FeedTournamentPost>) {
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchMixedPage(pageParam, PAGE_SIZE, fetchMatches, fetchPosts),
    initialPageParam: undefined as Date | undefined,
    getNextPageParam: (lastPage) => lastPage.next,
  });
}

/** Confirmed matches and tournament results where you or a friend played, newest first, a page at a time. */
export function useFriendsFeed() {
  return useFeedPages(friendsFeedKey, fetchFriendsFeed, fetchFriendsTournamentPosts);
}

/** Confirmed matches and tournament results at your clubs, or at the club with `clubId`. */
export function useClubsFeed(clubId?: string) {
  return useFeedPages(
    [...communityFeedKey, "clubs", clubId ?? null],
    (before, limit) => fetchClubsFeed(clubId, before, limit),
    (before, limit) => fetchClubsTournamentPosts(clubId, before, limit),
  );
}

/** Confirmed matches and tournament results anywhere in Tunisia, or in `city`. */
export function useTunisiaFeed(city?: string) {
  return useFeedPages(
    [...communityFeedKey, "tunisia", city ?? null],
    (before, limit) => fetchTunisiaFeed(city, before, limit),
    (before, limit) => fetchTunisiaTournamentPosts(city, before, limit),
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
