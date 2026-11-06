import { t } from "i18next";
import { BottomSheet, Button, cn, useToast } from "heroui-native";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Flag,
} from "lucide-react-native";
import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import {
  BottomSheetFooter,
  BottomSheetScrollView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";

import { ConnectButton } from "@/components/connect-button";
import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import { ReportPlayerSheet } from "@/components/report-player-sheet";
import { mockPlayerStats } from "@/data/mock";
import type { PlayerTagCount } from "@/data/player-tags";
import { useFreshPlayer, usePlayerDetails, usePlayerTags } from "@/hooks/usePlayers";
import { formatMatchDay } from "@/lib/format-date";
import type {
  Player,
  PlayerDetails,
  PlayerStats,
  PlayerSuggestion,
} from "@/types/player";

// The preview fits its content like the other sheets; until it's measured, open this tall
const PREVIEW_FALLBACK_HEIGHT = 380;
// gorhom's handle: 10 pt above and below the 5 pt grab bar
const HANDLE_HEIGHT = 25;
// design: the full profile starts just below the status bar (54 px on the 844 px artboard)
const FULL_HEIGHT = "92%";
const FULL_INDEX = 1;
// Space under the buttons; a little tighter than design.md's 34 px, as asked for this sheet
const BOTTOM_ACTION_GAP = 24;

const sideLabels = {
  left: "side.leftSide",
  right: "side.rightSide",
  both: "playerSheet.bothSides",
} as const;

type PlayerSheetProps = {
  /**
   * The player to show; keep passing the last one while the sheet closes. A plain player
   * (e.g. from a match line-up) gets its connection state from the profile query.
   */
  player: PlayerSuggestion | Player | undefined;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Tap a player (design: Player preview v2): a quick preview that "Full profile"
 * expands, in the same sheet, to the whole profile.
 */
export function PlayerSheet({
  player: listed,
  isOpen,
  onOpenChange,
}: PlayerSheetProps) {
  const sheet = useRef<GorhomBottomSheet>(null);
  const [isFull, setIsFull] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [previewHeight, setPreviewHeight] = useState<number>();
  const { data: details } = usePlayerDetails(listed?.id);
  // Memoised: useFreshPlayer compares snapshots by identity
  const suggestion = useMemo<PlayerSuggestion | undefined>(() => {
    if (!listed || "connection" in listed) return listed;
    return {
      ...listed,
      connection: details?.connection ?? "none",
      mutualFriendCount: details?.mutualFriendCount,
    };
  }, [listed, details?.connection, details?.mutualFriendCount]);
  const player = useFreshPlayer(suggestion);

  function handleOpenChange(open: boolean) {
    onOpenChange(open);
    if (!open) setIsFull(false);
  }

  return (
    <Fragment>
      <BottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content
            ref={sheet}
            snapPoints={[
              previewHeight
                ? previewHeight + HANDLE_HEIGHT
                : PREVIEW_FALLBACK_HEIGHT,
              FULL_HEIGHT,
            ]}
            enableDynamicSizing={false}
            enableOverDrag={false}
            onChange={(index: number) => setIsFull(index === FULL_INDEX)}
            contentContainerClassName="h-full p-0"
            handleIndicatorClassName="h-[5px] w-10 bg-line-input"
            // The sheet's own footer sits on its real bottom edge, like Create match's Publish button
            footerComponent={
              isFull && player
                ? (props: BottomSheetFooterProps) => (
                    <BottomSheetFooter {...props}>
                      <FullProfileActions player={player} />
                    </BottomSheetFooter>
                  )
                : undefined
            }
          >
            {player ? (
              isFull ? (
                <FullProfile
                  player={player}
                  details={details}
                  onReport={() => setIsReporting(true)}
                  onCollapse={() => {
                    setIsFull(false);
                    sheet.current?.snapToIndex(0);
                  }}
                />
              ) : (
                <Preview
                  player={player}
                  details={details}
                  onHeight={setPreviewHeight}
                  onExpand={() => {
                    setIsFull(true);
                    sheet.current?.snapToIndex(FULL_INDEX);
                  }}
                />
              )
            ) : null}
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
      <ReportPlayerSheet
        player={player}
        lastPlayedTogetherAt={details?.lastPlayedTogetherAt}
      playedTogether={(details?.playedTogether ?? 0) > 0}
        isOpen={isReporting}
        onOpenChange={setIsReporting}
      />
    </Fragment>
  );
}

function sideAndCity(player: PlayerSuggestion, details?: PlayerDetails) {
  return [details ? t(sideLabels[details.side]) : null, player.city]
    .filter(Boolean)
    .join(" · ");
}

function Header({
  player,
  details,
  children,
}: {
  player: PlayerSuggestion;
  details?: PlayerDetails;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <View className="flex-row items-center gap-3.5">
      <PlayerAvatar player={player} size={68} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          numberOfLines={1}
          accessibilityRole="header"
          className="font-black text-[20px] tracking-[-0.3px] text-foreground"
        >
          {player.firstName} {player.lastName}
        </Text>
        <Text numberOfLines={1} className="font-normal text-[13px] text-muted">
          {sideAndCity(player, details)}
        </Text>
        {children}
      </View>
      {player.level !== undefined ? (
        <View className="items-center rounded-2xl bg-success-soft px-3 py-2">
          <Text className="font-black text-[24px] leading-[26px] text-success">
            {player.level.toFixed(1)}
          </Text>
          <Text className="font-bold text-[11px] text-success">
            {t("profile.levelWord")}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Strong({ children }: { children: ReactNode }) {
  return <Text className="font-black text-foreground">{children}</Text>;
}

function Tag({ tag, count }: PlayerTagCount) {
  const { t } = useTranslation();

  return (
    <Text className="overflow-hidden rounded-xl bg-accent-soft px-2.5 py-1.5 font-bold text-[12px] text-accent-soft-foreground">
      {t(`playerTags.${tag}`)} · {count}
    </Text>
  );
}

type PreviewProps = {
  player: PlayerSuggestion;
  details?: PlayerDetails;
  /** The preview's measured height, so the sheet can fit it */
  onHeight: (height: number) => void;
  onExpand: () => void;
};

function Preview({ player, details, onHeight, onExpand }: PreviewProps) {
  const { t } = useTranslation();
  const mutual = player.mutualFriendCount ?? 0;
  const stats = mockPlayerStats;
  const { data: tags = [] } = usePlayerTags(player.id);

  return (
    <View
      className="gap-4 px-5 pt-1"
      style={{ paddingBottom: BOTTOM_ACTION_GAP }}
      onLayout={(event) => onHeight(Math.ceil(event.nativeEvent.layout.height))}
    >
      <Header player={player} details={details}>
        <Text className="font-normal text-[13px] text-muted">
          <Strong>{mutual}</Strong>{" "}
          {t("playerSheet.mutualFriends", { count: mutual })}
        </Text>
      </Header>

      <View className="flex-row gap-2">
        {[
          { value: String(stats.matches), label: t("playerSheet.matches") },
          {
            value: `${Math.round((stats.won / stats.matches) * 100)}%`,
            label: t("playerSheet.winRate"),
          },
        ].map((stat) => (
          <View
            key={stat.label}
            className="flex-1 items-center rounded-[14px] bg-background p-2.5"
          >
            <Text className="font-black text-[18px] text-foreground">
              {stat.value}
            </Text>
            <Text className="font-normal text-[12px] text-muted">
              {stat.label}
            </Text>
          </View>
        ))}
      </View>

      {tags.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {tags.slice(0, 3).map((item) => (
            <Tag key={item.tag} {...item} />
          ))}
        </View>
      ) : null}

      <PlayedTogether details={details} />

      <View className="flex-row gap-2.5">
        <View className="flex-1">
          <ConnectButton player={player} size="lg" />
        </View>
        <Button
          size="lg"
          variant="secondary"
          onPress={onExpand}
          className="h-[52px] flex-1 rounded-2xl"
        >
          <Button.Label className="text-[16px]">
            {t("playerSheet.fullProfile")}
          </Button.Label>
          <Icon as={ChevronUp} size={16} color="primary-dark" />
        </Button>
      </View>
    </View>
  );
}

function PlayedTogether({ details }: { details?: PlayerDetails }) {
  const { t } = useTranslation();
  if (!details || details.playedTogether === 0) return null;
  const times =
    details.playedTogether === 1
      ? t("playerSheet.once")
      : details.playedTogether === 2
        ? t("playerSheet.twice")
        : t("playerSheet.times", { count: details.playedTogether });
  return (
    <View className="flex-row items-center gap-2.5">
      <Icon as={CalendarDays} size={18} color="accent" />
      <Text className="flex-1 font-normal text-[14px] text-ink-2">
        {t("playerSheet.playedTogether")} <Strong>{times}</Strong>
        {details.lastPlayedTogetherAt
          ? t("playerSheet.lastOn", {
              date: formatMatchDay(details.lastPlayedTogetherAt),
            })
          : ""}
      </Text>
    </View>
  );
}

type FullProfileProps = {
  player: PlayerSuggestion;
  details?: PlayerDetails;
  onCollapse: () => void;
  onReport: () => void;
};

function FullProfile({
  player,
  details,
  onCollapse,
  onReport,
}: FullProfileProps) {
  const { t } = useTranslation();
  const stats: PlayerStats = mockPlayerStats;
  const { data: tags = [] } = usePlayerTags(player.id);
  const winRate = Math.round((stats.won / stats.matches) * 100);

  return (
    <View className="flex-1">
      {/* One white surface from header to buttons, like the other sheets */}
      <View className="gap-3 bg-surface px-5 pb-2 pt-1">
        <Button
          isIconOnly
          variant="ghost"
          accessibilityLabel={t("playerSheet.showLess")}
          onPress={onCollapse}
          className="size-9 rounded-full bg-background"
        >
          <Icon as={ChevronDown} size={18} color="foreground" />
        </Button>
        <Header player={player} details={details}>
          <Text className="font-normal text-[13px] text-muted">
            {details ? <Strong>{details.friendCount}</Strong> : null}
            {details
              ? ` ${t("playerSheet.friendsWord", { count: details.friendCount })}`
              : ""}
            <Strong>{player.mutualFriendCount ?? 0}</Strong>{" "}
            {t("playerSheet.mutualShort")}
          </Text>
        </Header>
        {details?.bio ? (
          <Text className="font-normal text-[14px] leading-5 text-ink-2">
            {details.bio}
          </Text>
        ) : null}
      </View>

      <BottomSheetScrollView
        contentContainerClassName="gap-3.5 px-5 pt-4"
        contentContainerStyle={{
          paddingBottom: 110,
        }}
      >
        <View className="flex-row rounded-[20px] border border-line bg-surface px-4 py-3.5">
          {[
            {
              value: String(stats.matches),
              label: t("playerSheet.played"),
              tone: "text-foreground",
            },
            {
              value: String(stats.won),
              label: t("playerSheet.won"),
              tone: "text-accent",
            },
            {
              value: String(stats.lost),
              label: t("playerSheet.lost"),
              tone: "text-attention-action",
            },
            {
              value: `${winRate}%`,
              label: t("playerSheet.winRate"),
              tone: "text-foreground",
            },
          ].map((stat) => (
            <View key={stat.label} className="flex-1 items-center">
              <Text className={cn("font-black text-[18px]", stat.tone)}>
                {stat.value}
              </Text>
              <Text className="font-normal text-[11px] text-muted">
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {details && details.playedTogether > 0 ? (
          <View className="gap-2 rounded-[20px] border border-line bg-surface px-4 py-3.5">
            <View className="flex-row items-baseline justify-between">
              <Text className="font-black text-[15px] text-foreground">
                {t("playerSheet.youAnd", { name: player.firstName })}
              </Text>
              {details.lastPlayedTogetherAt ? (
                <Text className="font-normal text-[12px] text-muted">
                  {t("playerSheet.lastPlayed", {
                    date: formatMatchDay(details.lastPlayedTogetherAt),
                  })}
                </Text>
              ) : null}
            </View>
            <View className="flex-row gap-2">
              {[
                {
                  label: t("playerSheet.asPartners"),
                  record: stats.asPartners,
                },
                {
                  label: t("playerSheet.asOpponents"),
                  record: stats.asOpponents,
                },
              ].map(({ label, record }) => (
                <View
                  key={label}
                  className="flex-1 rounded-xl bg-background px-2.5 py-2"
                >
                  <Text className="font-bold text-[12px] text-muted">
                    {label}
                  </Text>
                  <Text className="font-black text-[15px] text-foreground">
                    {t("playerSheet.record", {
                      won: record.won,
                      lost: record.lost,
                    })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {details && details.clubNames.length > 0 ? (
          <View className="gap-2">
            <Text className="font-black text-[15px] text-foreground">
              {t("playerSheet.usuallyPlaysAt")}
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {details.clubNames.map((name) => (
                <Text
                  key={name}
                  className="overflow-hidden rounded-[14px] border border-line-input bg-surface px-3 py-1.5 font-bold text-[13px] text-foreground"
                >
                  {name}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        {tags.length > 0 ? (
          <View className="gap-2">
            <Text className="font-black text-[15px] text-foreground">
              {t("playerSheet.whatPlayersSay")}
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {tags.map((item) => (
                <Tag key={item.tag} {...item} />
              ))}
            </View>
          </View>
        ) : null}

        <Button
          variant="outline"
          onPress={onReport}
          className="h-12 rounded-2xl border-attention-outline bg-surface"
        >
          <Icon as={Flag} size={15} color="attention-action" />
          <Button.Label className="text-[15px] text-attention-action">
            {t("playerSheet.report")}
          </Button.Label>
        </Button>
      </BottomSheetScrollView>
    </View>
  );
}

/** "Invite to a match" and Connect, pinned under the full profile. */
function FullProfileActions({ player }: { player: PlayerSuggestion }) {
  const { t } = useTranslation();
  const { toast } = useToast();

  return (
    <View
      className="flex-row gap-2.5 border-t border-line bg-surface px-5 pt-3.5"
      style={{ paddingBottom: BOTTOM_ACTION_GAP }}
    >
      {/* Connect stays on the left, where it was in the preview */}
      <View className="flex-1">
        <ConnectButton player={player} size="lg" />
      </View>
      <Button
        variant="secondary"
        onPress={() =>
          // Inviting needs the matches API
          toast.show({
            label: t("playerSheet.inviteSoon"),
            description: t("playerSheet.inviteSoonText"),
          })
        }
        className="h-[52px] flex-1 rounded-2xl"
      >
        <Button.Label className="text-[16px]">
          {t("playerSheet.invite")}
        </Button.Label>
      </Button>
    </View>
  );
}
