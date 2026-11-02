import { cn } from "heroui-native";
import { t } from "i18next";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { ConnectButton } from "@/components/connect-button";
import { FilterChip } from "@/components/filter-chip";
import { Page } from "@/components/page";
import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { PlayerSuggestionRow } from "@/components/player-suggestion-row";
import { SectionHeader } from "@/components/section-header";
import { daysUntil } from "@/lib/format-date";
import type { DiscoverPlayer } from "@/types/player";

// Friends to make before the circle counts as started
export const CIRCLE_GOAL = 3;
// design: discover cards are 156 px wide, 10 px apart
const CARD_WIDTH = 156;
const CARD_GAP = 10;
const MAX_CARDS = 8;
// "Also new on Padelna" and the "New near you" list look at this many days
const NEW_DAYS = 14;
const MAX_NEW = 4;

const filters = ["for-you", "same-level", "left-side", "near-me"] as const;
type FilterId = (typeof filters)[number];

const filterLabels = {
  "for-you": "players.filterForYou",
  "same-level": "players.filterSameLevel",
  "left-side": "players.filterLeftSide",
  "near-me": "players.filterNearMe",
} as const;

const sideLabels = {
  left: "side.leftSide",
  right: "side.rightSide",
  both: "playerSheet.bothSides",
} as const;

type Me = { level?: number; city?: string; side?: "left" | "right" | "both" };

function daysSince(date: Date) {
  return -daysUntil(date);
}

type CircleBannerProps = { done: number };

/** Blue "Build your padel circle · 0/3" strip (design canvas "Players · new player"). */
export function CircleBanner({ done }: CircleBannerProps) {
  const { t } = useTranslation();
  const shown = Math.min(done, CIRCLE_GOAL);

  return (
    <View
      accessible
      accessibilityLabel={`${t("players.circleTitle")}. ${t("players.circleHint", { count: CIRCLE_GOAL })}. ${shown}/${CIRCLE_GOAL}`}
      className="flex-row items-center gap-3 rounded-[18px] bg-accent px-3.5 py-3"
    >
      <View aria-hidden className="flex-row">
        {Array.from({ length: CIRCLE_GOAL }, (_, index) => (
          <View
            key={index}
            className={cn(
              "size-[30px] rounded-full",
              index > 0 && "-ms-2.5",
              index < shown
                ? "border-2 border-accent bg-lime"
                : "border-2 border-dashed border-white/60",
            )}
          />
        ))}
      </View>
      <View className="flex-1">
        <Text className="font-black text-[15px] text-accent-foreground">{t("players.circleTitle")}</Text>
        <Text className="font-normal text-[12px] text-primary-tint-text">
          {t("players.circleHint", { count: CIRCLE_GOAL })}
        </Text>
      </View>
      <Text className="overflow-hidden rounded-[10px] bg-white/15 px-2.5 py-1 font-black text-[13px] text-accent-foreground">
        {shown}/{CIRCLE_GOAL}
      </Text>
    </View>
  );
}

function reasonFor(player: DiscoverPlayer, me: Me) {
  const isNew = daysSince(player.joinedAt) <= NEW_DAYS;
  if (me.side === "right" && (player.side === "left" || player.side === "both")) {
    return t("players.reasonPartnerLeft");
  }
  if (me.side === "left" && (player.side === "right" || player.side === "both")) {
    return t("players.reasonPartnerRight");
  }
  if (isNew) return t("players.reasonNew");
  if (me.level !== undefined && player.level !== undefined && Math.abs(player.level - me.level) < 0.1) {
    return t("players.reasonSameLevel");
  }
  if (player.city && player.city === me.city) return t("players.reasonSameCity", { city: player.city });
  return t("players.reasonAroundLevel");
}

type DiscoverCardProps = { player: DiscoverPlayer; reason: string; onPress: () => void };

function DiscoverCard({ player, reason, onPress }: DiscoverCardProps) {
  const { t } = useTranslation();

  return (
    <View
      className="items-center gap-1 rounded-[20px] border border-line bg-surface px-3 pb-3 pt-3.5"
      style={{ width: CARD_WIDTH }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t("connections.viewProfile", { name: shortNameOf(player) })}
        className="items-center gap-1 self-stretch"
      >
        <View>
          <PlayerAvatar player={player} size={60} />
          {player.level !== undefined ? (
            <Text className="absolute -bottom-0.5 -end-1.5 overflow-hidden rounded-lg border-2 border-surface bg-lime-soft px-1.5 font-black text-[11px] text-lime-foreground">
              {player.level.toFixed(1)}
            </Text>
          ) : null}
        </View>
        <Text numberOfLines={1} className="mt-1 font-bold text-[15px] text-foreground">
          {shortNameOf(player)}
        </Text>
        <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
          {[player.city, t(sideLabels[player.side])].filter(Boolean).join(" · ")}
        </Text>
      </Pressable>
      <View className="min-h-[30px] justify-center">
        <Text numberOfLines={2} className="text-center font-bold text-[11px] text-success">
          {reason}
        </Text>
      </View>
      <ConnectButton player={player} size="card" />
    </View>
  );
}

function joinedText(date: Date) {
  const days = daysSince(date);
  if (days <= 0) return t("players.joinedToday");
  if (days < 7) return t("players.joinedDaysAgo", { count: days });
  return t("players.joinedWeeksAgo", { count: Math.floor(days / 7) });
}

type PlayersNewPlayerProps = {
  players: DiscoverPlayer[];
  me: Me;
  onPreview: (player: DiscoverPlayer) => void;
};

/**
 * Players tab for someone with no matches yet (design canvas "Players · new player"):
 * players to discover around your level, and the newest members.
 */
export function PlayersNewPlayer({ players, me, onPreview }: PlayersNewPlayerProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterId>("for-you");

  const discover = useMemo(() => {
    const matching = players.filter((player) => {
      if (filter === "same-level") {
        return me.level !== undefined && player.level !== undefined && Math.abs(player.level - me.level) < 0.1;
      }
      if (filter === "left-side") return player.side === "left" || player.side === "both";
      if (filter === "near-me") return player.city === me.city;
      return true;
    });
    return matching.slice(0, MAX_CARDS);
  }, [players, filter, me.level, me.city]);

  // Newest members first, leaving out the ones already in the carousel
  const newcomers = useMemo(() => {
    const shown = new Set(discover.map((player) => player.id));
    return players
      .filter((player) => daysSince(player.joinedAt) <= NEW_DAYS && !shown.has(player.id))
      .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime())
      .slice(0, MAX_NEW);
  }, [players, discover]);

  const subtitle = [
    me.level !== undefined ? t("players.discoverSubtitle", { level: me.level.toFixed(1), city: me.city ?? "" }) : null,
  ]
    .filter(Boolean)
    .join("")
    .replace(/ · $/, "");

  return (
    <>
      <View className="gap-2.5">
        <SectionHeader size="sm" title={t("players.discoverTitle")} subtitle={subtitle || undefined} />
        <Page.Carousel gap={8}>
          {filters.map((id) => (
            <FilterChip
              key={id}
              label={t(filterLabels[id])}
              selected={filter === id}
              onPress={() => setFilter(id)}
            />
          ))}
        </Page.Carousel>
        {discover.length === 0 ? (
          <Text className="font-normal text-[14px] leading-5 text-muted">{t("players.discoverEmpty")}</Text>
        ) : (
          <Page.Carousel itemWidth={CARD_WIDTH} gap={CARD_GAP}>
            {discover.map((player) => (
              <DiscoverCard
                key={player.id}
                player={player}
                reason={reasonFor(player, me)}
                onPress={() => onPreview(player)}
              />
            ))}
          </Page.Carousel>
        )}
      </View>

      {newcomers.length > 0 ? (
        <View className="gap-2">
          <SectionHeader size="sm" title={t("players.newNearYou")} />
          {newcomers.map((player) => (
            <PlayerSuggestionRow
              key={player.id}
              player={player}
              details={[
                player.level?.toFixed(1),
                player.city,
                joinedText(player.joinedAt),
              ]
                .filter(Boolean)
                .join(" · ")}
              onPress={() => onPreview(player)}
              action={<ConnectButton player={player} />}
            />
          ))}
        </View>
      ) : null}
    </>
  );
}
