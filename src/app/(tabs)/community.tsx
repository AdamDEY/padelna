import { router } from "expo-router";
import { cn, Spinner, Tabs } from "heroui-native";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { ChoiceChips } from "@/components/choice-chips";
import { ClubsWeekBanner } from "@/components/clubs-week-banner";
import { CommunityFeed, CommunityFeedEmpty } from "@/components/community-feed";
import { FriendsNewPlayer } from "@/components/community-friends-new-player";
import { IconButton } from "@/components/icon-button";
import { Page, usePageMargins } from "@/components/page";
import { PlayerSheet } from "@/components/player-sheet";
import { RISING_PLAYER_WIDTH, RisingPlayer } from "@/components/rising-player";
import { SectionHeader } from "@/components/section-header";
import { ShareMatchSheet } from "@/components/share-match-sheet";
import {
  useClubsFeed,
  useClubsWeek,
  useCommunityCities,
  useFriendsFeed,
  useRisingPlayers,
  useTunisiaFeed,
} from "@/hooks/useFeed";
import { communityFeedKey } from "@/hooks/useMatches";
import { useMyAccount } from "@/hooks/useMyProfile";
import { playersKey, useMyClubs } from "@/hooks/usePlayers";
import { queryClient } from "@/lib/query-client";
import type { PlayerSuggestion } from "@/types/player";

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
  const [isShareOpen, setIsShareOpen] = useState(false);
  const { data: account } = useMyAccount();

  return (
    <Page>
      <Page.Body
        onRefresh={() =>
          Promise.all([
            queryClient.refetchQueries({ queryKey: communityFeedKey, type: "active" }),
            // A full match at a new club makes it one of your clubs
            feed === "clubs" ? queryClient.refetchQueries({ queryKey: [...playersKey, "my-clubs"] }) : null,
          ])
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

        {!account ? (
          <Spinner accessibilityLabel={t("community.loading")} className="self-start" />
        ) : feed === "friends" ? (
          <FriendsFeed myId={account.id} onSeeAllTunisia={() => setFeed("tunisia")} />
        ) : feed === "clubs" ? (
          <ClubsFeed myId={account.id} />
        ) : (
          <TunisiaFeed myId={account.id} />
        )}
      </Page.Body>

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

type FeedProps = {
  /** The signed-in player */
  myId: string;
};

function FriendsFeed({ myId, onSeeAllTunisia }: FeedProps & { onSeeAllTunisia: () => void }) {
  const { data: account } = useMyAccount();
  const feed = useFriendsFeed();

  return (
    <CommunityFeed
      feed={feed}
      myId={myId}
      // Nothing to show yet: what this tab is for, and people to connect with
      empty={
        account ? (
          <FriendsNewPlayer
            me={{ id: account.id, firstName: account.firstName, lastName: account.lastName, avatarUrl: account.avatarUrl }}
            onSeeAllTunisia={onSeeAllTunisia}
          />
        ) : null
      }
    />
  );
}

function ClubsFeed({ myId }: FeedProps) {
  const { t } = useTranslation();
  const [club, setClub] = useState(ALL);
  const myClubs = useMyClubs();
  const week = useClubsWeek();
  const feed = useClubsFeed(club === ALL ? undefined : club);

  if (myClubs.data?.length === 0) {
    return <CommunityFeedEmpty title={t("community.noClubsTitle")} text={t("community.noClubsText")} />;
  }

  return (
    <>
      {myClubs.data ? (
        <ChoiceChips
          options={[
            { value: ALL, label: t("community.allMyClubs") },
            ...myClubs.data.map((item) => ({ value: item.id, label: item.name })),
          ]}
          value={club}
          onChange={setClub}
        />
      ) : null}
      {week.data ? (
        <ClubsWeekBanner
          matchesPlayed={week.data.matchesPlayed}
          openForYourLevel={week.data.openForYourLevel}
          onPress={() => router.push("/matches")}
        />
      ) : null}
      <CommunityFeed
        feed={feed}
        myId={myId}
        empty={<CommunityFeedEmpty title={t("community.emptyTitle")} text={t("community.emptyText")} />}
      />
    </>
  );
}

function TunisiaFeed({ myId }: FeedProps) {
  const { t } = useTranslation();
  const [city, setCity] = useState(ALL);
  const cities = useCommunityCities();
  const rising = useRisingPlayers();
  const feed = useTunisiaFeed(city === ALL ? undefined : city);
  const [viewed, setViewed] = useState<PlayerSuggestion>();
  const [isViewing, setIsViewing] = useState(false);

  return (
    <>
      {cities.data && cities.data.length > 0 ? (
        <ChoiceChips
          options={[
            { value: ALL, label: t("community.allCities") },
            ...cities.data.map((name) => ({ value: name, label: name })),
          ]}
          value={city}
          onChange={setCity}
        />
      ) : null}

      {/* Hidden until someone's level has gone up from matches this month */}
      {rising.data && rising.data.length > 0 ? (
        <View className="gap-2.5">
          <SectionHeader size="sm" title={t("community.rising")} />
          <Page.Carousel itemWidth={RISING_PLAYER_WIDTH} gap={10}>
            {rising.data.map((item) => (
              <RisingPlayer
                key={item.player.id}
                player={item.player}
                levelChange={item.levelChange}
                onPress={() => {
                  setViewed(item.player);
                  setIsViewing(true);
                }}
              />
            ))}
          </Page.Carousel>
        </View>
      ) : null}

      <CommunityFeed
        feed={feed}
        myId={myId}
        empty={<CommunityFeedEmpty title={t("community.emptyTitle")} text={t("community.emptyText")} />}
      />
      <PlayerSheet player={viewed} isOpen={isViewing} onOpenChange={setIsViewing} />
    </>
  );
}
