import { Button, SearchField, Spinner } from "heroui-native";
import { Fragment, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { ConnectButton } from "@/components/connect-button";
import { ConnectionRequestsBanner } from "@/components/connection-requests-banner";
import { ConnectionRequestsSheet } from "@/components/connection-requests-sheet";
import { Page } from "@/components/page";
import { CIRCLE_GOAL, CircleBanner, PlayersNewPlayer } from "@/components/players-new-player";
import { PlayedWithTile } from "@/components/played-with-tile";
import { PlayerSheet } from "@/components/player-sheet";
import { PlayerSuggestionRow } from "@/components/player-suggestion-row";
import { SectionHeader } from "@/components/section-header";
import { useMyPastMatches } from "@/hooks/useMatches";
import { useMyAccount } from "@/hooks/useMyProfile";
import {
  playersKey,
  useConnectionRequests,
  useDiscoverPlayers,
  usePlayerDetails,
  useMyClubs,
  usePlayedWith,
  usePlayersAtMyClubs,
  useSearchPlayers,
} from "@/hooks/usePlayers";
import { queryClient } from "@/lib/query-client";
import type { DiscoverPlayer, PlayerSuggestion } from "@/types/player";

// design: "You played with" shows four faces to a row
const TILES_PER_ROW = 4;
// Same as the database: shorter searches return nothing
const MIN_SEARCH_LENGTH = 2;

function refreshPlayers() {
  return queryClient.refetchQueries({ queryKey: playersKey });
}

function inRows<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, row) =>
    items.slice(row * size, row * size + size),
  );
}

/**
 * Players tab (design: Find players copy): search, connection requests, people you
 * played with, and players at your level at the clubs where you play.
 */
export default function Players() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  // Kept after the sheet closes so its content doesn't vanish mid-animation
  const [selected, setSelected] = useState<PlayerSuggestion>();
  const [isPreviewing, setIsPreviewing] = useState(false);
  function preview(player: PlayerSuggestion) {
    setSelected(player);
    setIsPreviewing(true);
  }
  const { data: requests = [] } = useConnectionRequests();
  const isSearching = query.trim().length >= MIN_SEARCH_LENGTH;
  const { data: pastMatches } = useMyPastMatches();
  const { data: account } = useMyAccount();
  // Someone with no match yet gets people to discover instead of "you played with"
  const isNewPlayer = pastMatches !== undefined && pastMatches.length === 0;
  const friendCount = usePlayerDetails(account?.id).data?.friendCount ?? 0;


  return (
    <Page>
      <Page.Body onRefresh={refreshPlayers} className="gap-[18px]">
        <View className="gap-3">
          <Page.Title>{t("players.title")}</Page.Title>
          <SearchField value={query} onChange={setQuery}>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder={t("players.searchPlaceholder")}
                accessibilityLabel={t("players.searchA11y")}
                autoCorrect={false}
                returnKeyType="search"
                className="h-[50px] rounded-2xl border-line text-[16px]"
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          {!isSearching && isNewPlayer && friendCount < CIRCLE_GOAL ? <CircleBanner done={friendCount} /> : null}
          {!isSearching && requests.length > 0 ? (
            <ConnectionRequestsBanner requesters={requests} onReview={() => setIsReviewing(true)} />
          ) : null}
        </View>

        {isSearching ? (
          <SearchResults query={query} onPreview={preview} />
        ) : isNewPlayer ? (
          <Discover me={{ level: account?.level, city: account?.city, side: account?.side }} onPreview={preview} />
        ) : (
          <Suggestions onPreview={preview} />
        )}
      </Page.Body>

      <PlayerSheet player={selected} isOpen={isPreviewing} onOpenChange={setIsPreviewing} />
      <ConnectionRequestsSheet
        requests={requests}
        isOpen={isReviewing}
        onOpenChange={setIsReviewing}
      />
    </Page>
  );
}

type PreviewProps = { onPreview: (player: PlayerSuggestion) => void };

function Discover({ me, onPreview }: PreviewProps & { me: React.ComponentProps<typeof PlayersNewPlayer>["me"] }) {
  const { t } = useTranslation();
  const discover = useDiscoverPlayers();

  return (
    <ListState query={discover} emptyText={t("players.discoverEmpty")}>
      {(players) => <PlayersNewPlayer players={players as DiscoverPlayer[]} me={me} onPreview={onPreview} />}
    </ListState>
  );
}

function Suggestions({ onPreview }: PreviewProps) {
  const { t } = useTranslation();
  const playedWith = usePlayedWith();
  const atMyClubs = usePlayersAtMyClubs();
  const { data: myClubs = [] } = useMyClubs();
  const clubNames = myClubs.map((club) => club.name).join(" · ");

  return (
    <>
      <View className="gap-2.5">
        <SectionHeader size="sm" title={t("players.playedWith")} />
        <ListState
          query={playedWith}
          emptyText={t("players.playedWithEmpty")}
        >
          {(players) =>
            inRows(players, TILES_PER_ROW).map((row, index) => (
              <View key={index} className="flex-row gap-2">
                {row.map((player) => (
                  <PlayedWithTile key={player.id} player={player} onPress={() => onPreview(player)} />
                ))}
                {/* Empty cells keep the last row's faces in their columns */}
                {Array.from({ length: TILES_PER_ROW - row.length }, (_, cell) => (
                  <View key={`empty-${cell}`} className="flex-1" />
                ))}
              </View>
            ))
          }
        </ListState>
      </View>

      <View className="gap-2">
        <SectionHeader size="sm" title={t("players.levelAtClubs")} subtitle={clubNames || undefined} />
        <ListState
          query={atMyClubs}
          emptyText={
            myClubs.length === 0
              ? t("players.noClubsEmpty")
              : t("players.noOneNew")
          }
        >
          {(players) =>
            players.map((player) => (
              <PlayerSuggestionRow
                key={player.id}
                player={player}
                onPress={() => onPreview(player)}
                action={<ConnectButton player={player} />}
              />
            ))
          }
        </ListState>
      </View>
    </>
  );
}

function SearchResults({ query, onPreview }: PreviewProps & { query: string }) {
  const { t } = useTranslation();
  const results = useSearchPlayers(query);

  return (
    <View className="gap-2">
      <ListState query={results} emptyText={t("players.noMatch", { query: query.trim() })}>
        {(players) =>
          players.map((player) => (
            <PlayerSuggestionRow
              key={player.id}
              player={player}
              onPress={() => onPreview(player)}
              action={<ConnectButton player={player} />}
            />
          ))
        }
      </ListState>
    </View>
  );
}

type ListStateProps = {
  query: {
    data?: PlayerSuggestion[] | DiscoverPlayer[];
    error: Error | null;
    refetch: () => unknown;
    isRefetching: boolean;
  };
  emptyText: string;
  children: (players: PlayerSuggestion[]) => ReactNode;
};

/** Loading, error and empty states shared by the Players lists. */
function ListState({ query, emptyText, children }: ListStateProps) {
  const { t } = useTranslation();
  if (query.error) {
    return (
      <View className="items-start gap-2">
        <Text className="font-normal text-[14px] text-muted">
          {t("players.loadFailed", { message: query.error.message })}
        </Text>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => query.refetch()}
          isDisabled={query.isRefetching}
        >
          {t("matches.tryAgain")}
        </Button>
      </View>
    );
  }
  if (!query.data) return <Spinner accessibilityLabel={t("players.loading")} className="self-start" />;
  if (query.data.length === 0) {
    return <Text className="font-normal text-[14px] leading-5 text-muted">{emptyText}</Text>;
  }
  return <Fragment>{children(query.data)}</Fragment>;
}
