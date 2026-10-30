import { Button, cn, Spinner, Tabs } from "heroui-native";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { ChoiceChips } from "@/components/choice-chips";
import { ConnectButton } from "@/components/connect-button";
import { ClubsWeekBanner } from "@/components/clubs-week-banner";
import { ConnectSheet } from "@/components/connect-sheet";
import { IconButton } from "@/components/icon-button";
import { Page, usePageMargins } from "@/components/page";
import { PlayerSheet } from "@/components/player-sheet";
import { ResultPostCard } from "@/components/result-post-card";
import { RISING_PLAYER_WIDTH, RisingPlayer } from "@/components/rising-player";
import { SectionHeader } from "@/components/section-header";
import { ShareMatchSheet } from "@/components/share-match-sheet";
import {
  clubPosts,
  clubsThisWeek,
  me,
  myClubNames,
  myFriendIds,
  risingPlayers,
  tunisiaCities,
  tunisiaPosts,
} from "@/data/mock";
import { useFriendsFeed } from "@/hooks/useFeed";
import { friendsFeedKey, useMatchPhotoUrl } from "@/hooks/useMatches";
import { useMyAccount } from "@/hooks/useMyProfile";
import { toFeedPost } from "@/lib/feed-post";
import { queryClient } from "@/lib/query-client";
import type { Player, PlayerSuggestion } from "@/types/player";
import type { FeedMatch, ResultPost } from "@/types/post";

type Feed = "friends" | "clubs" | "tunisia";

const feeds = [
  { value: "friends", label: "community.tabFriends" },
  { value: "clubs", label: "community.tabClubs" },
  { value: "tunisia", label: "community.tabTunisia" },
] as const;

const ALL = "all";

export default function Community() {
  const { t } = useTranslation();
  const [feed, setFeed] = useState<Feed>("friends");
  // The match whose players are shown in the Connect sheet
  const [connectPost, setConnectPost] = useState<ResultPost | null>(null);
  // Pending connection requests, kept while you switch feeds
  const [requestedIds, setRequestedIds] = useState<Set<string>>(() => new Set());
  const [isShareOpen, setIsShareOpen] = useState(false);

  function toggleRequest(playerId: string) {
    setRequestedIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  return (
    <Page>
      <Page.Body
        // The sample feeds have nothing to reload
        onRefresh={
          feed === "friends"
            ? () => queryClient.refetchQueries({ queryKey: friendsFeedKey })
            : undefined
        }
      >
        <Page.Title action={<IconButton
              icon={Plus}
              label={t("community.share")}
              variant="primary"
              onPress={() => setIsShareOpen(true)}
            />}>
          {t("community.title")}
        </Page.Title>

        <FeedTabs value={feed} onChange={setFeed} />

        {feed === "friends" ? <FriendsFeed /> : null}
        {feed === "clubs" ? <ClubsFeed onConnect={setConnectPost} /> : null}
        {feed === "tunisia" ? <TunisiaFeed onConnect={setConnectPost} /> : null}
      </Page.Body>

      <ConnectSheet
        post={connectPost}
        onClose={() => setConnectPost(null)}
        meId={me.id}
        friendIds={myFriendIds}
        requestedIds={requestedIds}
        onToggleRequest={toggleRequest}
      />
      <ShareMatchSheet isOpen={isShareOpen} onOpenChange={setIsShareOpen} />
    </Page>
  );
}

/** Underline tabs; the line under them runs edge to edge. Must render inside Page. */
function FeedTabs({ value, onChange }: { value: Feed; onChange: (feed: Feed) => void }) {
  const { t } = useTranslation();
  const margins = usePageMargins();

  return (
    // The wrapper draws the full-width line; the tabs stay inside the page margin
    <View className={cn("border-b border-line", margins.bleed, margins.inset)}>
      <Tabs value={value} onValueChange={(next) => onChange(next as Feed)} variant="secondary">
        <Tabs.List className="gap-[22px] border-b-0">
        <Tabs.Indicator className="border-b-[3px]" />
        {feeds.map((item) => (
          <Tabs.Trigger key={item.value} value={item.value} className="h-10 px-0">
            {({ isSelected }) => (
              <Tabs.Label
                className={cn(
                  "text-[15px]",
                  isSelected ? "font-bold text-foreground" : "font-semibold text-muted",
                )}
              >
                {t(item.label)}
              </Tabs.Label>
            )}
          </Tabs.Trigger>
        ))}
        </Tabs.List>
      </Tabs>
    </View>
  );
}

function FriendsFeed() {
  const { t } = useTranslation();
  const { data: account } = useMyAccount();
  const { data, error, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFriendsFeed();
  const matches = data?.pages.flat();
  // Kept as ids so the sheets show the latest connection states after a refresh
  const [connectMatchId, setConnectMatchId] = useState<string>();
  const [viewedPlayer, setViewedPlayer] = useState<Player>();
  const [isViewingPlayer, setIsViewingPlayer] = useState(false);
  const connectMatch = matches?.find((match) => match.id === connectMatchId);
  const myId = account?.id ?? "";

  if (error) {
    return (
      <View className="items-start gap-2">
        <Text className="font-normal text-[14px] text-muted">{t("community.loadFailed", { message: error.message })}</Text>
        <Button size="sm" variant="secondary" onPress={() => refetch()} isDisabled={isRefetching}>
          {t("matches.tryAgain")}
        </Button>
      </View>
    );
  }
  if (!matches || !account) return <Spinner accessibilityLabel={t("community.loading")} className="self-start" />;
  if (matches.length === 0) {
    return (
      <View className="items-center gap-1 rounded-3xl border border-line bg-surface p-6">
        <Text className="font-bold text-[15px] text-foreground">{t("community.emptyFriendsTitle")}</Text>
        <Text className="text-center font-normal text-[14px] text-muted">
          {t("community.emptyFriendsText")}
        </Text>
      </View>
    );
  }

  return (
    <>
      {matches.map((match) => (
        <FeedCard
          key={match.id}
          match={match}
          myId={myId}
          onConnect={() => setConnectMatchId(match.id)}
          onPlayerPress={(player) => {
            if (player.id === myId) return;
            setViewedPlayer(player);
            setIsViewingPlayer(true);
          }}
        />
      ))}

      {hasNextPage ? (
        <Button
          variant="secondary"
          onPress={() => fetchNextPage()}
          isDisabled={isFetchingNextPage}
          className="self-center"
        >
          {isFetchingNextPage ? t("community.loadingMore") : t("community.showOlder")}
        </Button>
      ) : null}

      <ConnectSheet
        post={connectMatch ? toFeedPost(connectMatch, myId).post : null}
        onClose={() => setConnectMatchId(undefined)}
        meId={myId}
        renderAction={(player) => {
          const suggestion = connectMatch?.seats.find((seat) => seat.id === player.id);
          return suggestion ? <ConnectButton player={suggestion} /> : null;
        }}
      />
      <PlayerSheet player={viewedPlayer} isOpen={isViewingPlayer} onOpenChange={setIsViewingPlayer} />
    </>
  );
}

type FeedCardProps = {
  match: FeedMatch;
  myId: string;
  onConnect: () => void;
  onPlayerPress: (player: Player) => void;
};

/** One Friends-feed result, told from your side, with its photo when the host added one. */
function FeedCard({ match, myId, onConnect, onPlayerPress }: FeedCardProps) {
  const { t } = useTranslation();
  const { data: photoUrl, isError } = useMatchPhotoUrl(match.photoPath);
  // "" keeps the photo's frame while its link loads; a photo that can't load falls back to the scoreboard
  const card = toFeedPost(match, myId, match.photoPath && !isError ? (photoUrl ?? "") : undefined);

  return (
    <ResultPostCard
      post={card.post}
      title={card.title}
      note={card.note}
      friendIds={card.friendIds}
      onPlayerPress={(player) => onPlayerPress(player as PlayerSuggestion)}
      headerAction={
        card.canConnect ? (
          <Button
            size="sm"
            // Light blue, so a feed of Connect buttons doesn't compete with the screen's main action
            variant="secondary"
            onPress={onConnect}
            hitSlop={6}
            className="h-8 rounded-[10px] px-3"
          >
            {t("connect.connect")}
          </Button>
        ) : undefined
      }
    />
  );
}

type FeedProps = {
  /** Opens the Connect sheet for a post */
  onConnect: (post: ResultPost) => void;
};

function ClubsFeed({ onConnect }: FeedProps) {
  const { t } = useTranslation();
  const [club, setClub] = useState(ALL);
  const posts = clubPosts.filter((post) => club === ALL || post.clubName === club);

  return (
    <>
      <ChoiceChips
        options={[
          { value: ALL, label: t("community.allMyClubs") },
          ...myClubNames.map((name) => ({ value: name, label: name })),
        ]}
        value={club}
        onChange={setClub}
      />
      <ClubsWeekBanner
        matchesPlayed={clubsThisWeek.matchesPlayed}
        openForYourLevel={clubsThisWeek.openForYourLevel}
      />
      <PostList posts={posts} onConnect={onConnect} />
    </>
  );
}

function TunisiaFeed({ onConnect }: FeedProps) {
  const { t } = useTranslation();
  const [city, setCity] = useState(ALL);
  const posts = tunisiaPosts.filter((post) => city === ALL || post.city === city);

  return (
    <>
      <ChoiceChips
        options={[
          { value: ALL, label: t("community.allCities") },
          ...tunisiaCities.map((name) => ({ value: name, label: name })),
        ]}
        value={city}
        onChange={setCity}
      />

      <View className="gap-2.5">
        <SectionHeader size="sm" title={t("community.rising")} actionLabel={t("common.seeAll")} />
        <Page.Carousel itemWidth={RISING_PLAYER_WIDTH} gap={10}>
          {risingPlayers.map((rising) => (
            <RisingPlayer key={rising.player.id} {...rising} />
          ))}
        </Page.Carousel>
      </View>

      <PostList posts={posts} onConnect={onConnect} />
    </>
  );
}

/** Posts from players you don't know yet; Connect opens the sheet to pick who. */
function PostList({ posts, onConnect }: { posts: ResultPost[] } & FeedProps) {
  const { t } = useTranslation();
  if (posts.length === 0) {
    return (
      <View className="items-center gap-1 rounded-3xl border border-line bg-surface p-6">
        <Text className="font-bold text-[15px] text-foreground">{t("community.emptyTitle")}</Text>
        <Text className="text-center font-normal text-[14px] text-muted">
          {t("community.emptyText")}
        </Text>
      </View>
    );
  }

  return (
    <>
      {posts.map((post) => (
        <ResultPostCard
          key={post.id}
          post={post}
          headerAction={
            <Button
              size="sm"
              // Light blue, so a feed of Connect buttons doesn't compete with the screen's main action
              variant="secondary"
              onPress={() => onConnect(post)}
              hitSlop={6}
              className="h-8 rounded-[10px] px-3"
            >
              {t("connect.connect")}
            </Button>
          }
        />
      ))}
    </>
  );
}
