import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import { Button, Spinner } from "heroui-native";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { ConnectButton } from "@/components/connect-button";
import { ConnectSheet } from "@/components/connect-sheet";
import { PlayerSheet } from "@/components/player-sheet";
import { ResultPostCard } from "@/components/result-post-card";
import { useMatchPhotoUrl } from "@/hooks/useMatches";
import { toFeedPost } from "@/lib/feed-post";
import type { Player, PlayerSuggestion } from "@/types/player";
import type { FeedMatch } from "@/types/post";
import { errorMessage } from "@/lib/error-message";

type CommunityFeedProps = {
  feed: UseInfiniteQueryResult<InfiniteData<FeedMatch[]>>;
  /** The signed-in player, so cards are told from your side */
  myId: string;
  /** Shown when the feed has no matches */
  empty: ReactNode;
};

/** One Community feed: loading, error and empty states, its result cards and "Show older". */
export function CommunityFeed({ feed, myId, empty }: CommunityFeedProps) {
  const { t } = useTranslation();
  const { data, error, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } = feed;
  const matches = data?.pages.flat();

  if (error) {
    return (
      <View className="items-start gap-2">
        <Text className="font-normal text-[14px] text-muted">{t("community.loadFailed", { message: errorMessage(error) })}</Text>
        <Button size="sm" variant="secondary" onPress={() => refetch()} isDisabled={isRefetching}>
          {t("matches.tryAgain")}
        </Button>
      </View>
    );
  }
  if (!matches) return <Spinner accessibilityLabel={t("community.loading")} className="self-start" />;
  if (matches.length === 0) return empty;

  return (
    <>
      <FeedMatches matches={matches} myId={myId} />
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
    </>
  );
}

/** Empty card for a feed with nothing to show. */
export function CommunityFeedEmpty({ title, text }: { title: string; text: string }) {
  return (
    <View className="items-center gap-1 rounded-3xl border border-line bg-surface p-6">
      <Text className="font-bold text-[15px] text-foreground">{title}</Text>
      <Text className="text-center font-normal text-[14px] text-muted">{text}</Text>
    </View>
  );
}

type FeedMatchesProps = {
  matches: FeedMatch[];
  myId: string;
};

/** Result cards with the Connect and player sheets they open. */
export function FeedMatches({ matches, myId }: FeedMatchesProps) {
  // Kept as ids so the sheets show the latest connection states after a refresh
  const [connectMatchId, setConnectMatchId] = useState<string>();
  const [viewedPlayer, setViewedPlayer] = useState<Player>();
  const [isViewingPlayer, setIsViewingPlayer] = useState(false);
  const connectMatch = matches.find((match) => match.id === connectMatchId);

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

/** One feed result, told from your side, with its photo when the host added one. */
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
