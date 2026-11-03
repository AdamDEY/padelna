import { router } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { FeedMatches } from "@/components/community-feed";
import { ConnectButton } from "@/components/connect-button";
import { Page } from "@/components/page";
import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { PlayerSheet } from "@/components/player-sheet";
import { SectionHeader } from "@/components/section-header";
import { useTunisiaFeed } from "@/hooks/useFeed";
import { useDiscoverPlayers } from "@/hooks/usePlayers";
import type { Player, PlayerSuggestion } from "@/types/player";
import { errorMessage } from "@/lib/error-message";

// design: "People you may know" cards are 112 px wide, 10 px apart
const CARD_WIDTH = 112;
const CARD_GAP = 10;
const MAX_PEOPLE = 6;

type FriendsNewPlayerProps = {
  me: Player;
  /** Opens the All Tunisia tab */
  onSeeAllTunisia: () => void;
};

/**
 * Community · Friends before any friend has played (design canvas "Community · Friends · new
 * player"): what the tab is for, people to connect with, and one result from around Tunisia.
 */
export function FriendsNewPlayer({ me, onSeeAllTunisia }: FriendsNewPlayerProps) {
  const { t } = useTranslation();
  const discover = useDiscoverPlayers();
  const [viewed, setViewed] = useState<PlayerSuggestion>();
  const [isViewing, setIsViewing] = useState(false);
  const people = discover.data?.slice(0, MAX_PEOPLE);
  // The newest result from around Tunisia; the section is left out until there is one
  const latest = useTunisiaFeed().data?.pages[0]?.[0];

  return (
    <>
      <View className="flex-row items-center gap-3.5 rounded-3xl border border-line bg-surface p-4">
        <View aria-hidden className="flex-row">
          <PlayerAvatar player={me} size={40} ringClassName="border-surface" />
          <View className="-ms-3 size-10 rounded-full border-2 border-dashed border-slot-border bg-surface" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text accessibilityRole="header" className="font-black text-[15px] text-foreground">
            {t("community.emptyFriendsTitle")}
          </Text>
          <Text className="font-normal text-[13px] leading-[18px] text-muted">
            {t("community.emptyFriendsText")}
          </Text>
        </View>
      </View>

      <View className="gap-2.5">
        <SectionHeader
          size="sm"
          title={t("players.discoverTitle")}
          actionLabel={t("common.seeAll")}
          onPressAction={() => router.push("/players")}
        />
        {discover.error ? (
          <View className="items-start gap-2">
            <Text className="font-normal text-[14px] text-muted">
              {t("players.loadFailed", { message: errorMessage(discover.error) })}
            </Text>
            <Button size="sm" variant="secondary" onPress={() => discover.refetch()} isDisabled={discover.isRefetching}>
              {t("matches.tryAgain")}
            </Button>
          </View>
        ) : !people ? (
          <Spinner accessibilityLabel={t("players.loading")} className="self-start" />
        ) : people.length === 0 ? null : (
          <Page.Carousel itemWidth={CARD_WIDTH} gap={CARD_GAP}>
            {people.map((player) => (
              <View
                key={player.id}
                className="items-center gap-0.5 rounded-[18px] border border-line bg-surface px-2 pb-2.5 pt-3"
                style={{ width: CARD_WIDTH }}
              >
                <Pressable
                  onPress={() => {
                    setViewed(player);
                    setIsViewing(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("connections.viewProfile", { name: shortNameOf(player) })}
                  className="items-center gap-0.5 self-stretch"
                >
                  <PlayerAvatar player={player} size={48} />
                  <Text numberOfLines={1} className="mt-0.5 font-bold text-[13px] text-foreground">
                    {shortNameOf(player)}
                  </Text>
                  <Text numberOfLines={1} className="font-normal text-[11px] text-muted">
                    {[player.level?.toFixed(1), player.city].filter(Boolean).join(" · ")}
                  </Text>
                </Pressable>
                <View className="mt-1 self-stretch">
                  <ConnectButton player={player} size="sm" />
                </View>
              </View>
            ))}
          </Page.Carousel>
        )}
      </View>

      {latest ? (
        <View className="gap-2.5">
          <SectionHeader
            size="sm"
            title={t("community.meanwhileTitle")}
            actionLabel={t("common.seeAll")}
            onPressAction={onSeeAllTunisia}
          />
          <FeedMatches matches={[latest]} myId={me.id} />
        </View>
      ) : null}

      <PlayerSheet player={viewed} isOpen={isViewing} onOpenChange={setIsViewing} />
    </>
  );
}
