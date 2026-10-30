import { Button, PressableFeedback } from "heroui-native";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { LevelRangeChip } from "@/components/level-chip";
import { PlayerAvatar, stackTintIndices } from "@/components/player-avatar";
import { formatTime } from "@/lib/format-date";
import { isPlayableFit, type LevelFit } from "@/lib/level-fit";
import type { OpenMatch } from "@/types/match";

type MatchListItemProps = {
  match: OpenMatch;
  /** How the match's level range fits your level */
  fit: LevelFit;
  onPress?: () => void;
  onAskToJoin?: () => void;
};

/** An open match in the Matches list: time block, club, level, players, spots and fit. */
export function MatchListItem({ match, fit, onPress, onAskToJoin }: MatchListItemProps) {
  const { t } = useTranslation();
  const time = formatTime(match.startsAt);
  const playable = isPlayableFit(fit);
  const spotsLeft = Math.max(match.capacity - match.players.length, 0);
  const spotsLabel = t("match.spots", { count: spotsLeft });
  const priceLabel = match.price !== undefined ? `${match.price} TND` : undefined;
  const tintIndices = stackTintIndices(match.players);
  const fitText = fit === "great" ? t("matchItem.greatFit") : t("matchItem.goodFit");
  const note = playable
    ? match.isMixed
      ? t("matchItem.mixed", { fit: fitText })
      : fitText
    : t(fit === "above" ? "matchItem.above" : "matchItem.below");

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${[
        time,
        t("matchItem.minutesLong", { count: match.durationMinutes }),
        match.clubName,
        t("level.range", { min: match.levelMin.toFixed(1), max: match.levelMax.toFixed(1) }),
        t("match.spotsLeft", { count: spotsLeft }),
        priceLabel,
      ]
        .filter(Boolean)
        .join(", ")}. ${note}`}
    >
      <View className="flex-row gap-3.5 rounded-[20px] border border-line bg-surface p-3.5">
        <View className="w-[60px] items-center justify-center rounded-[14px] bg-fill">
          <Text className="font-black text-[17px] text-foreground">{time}</Text>
          <Text className="font-normal text-[12px] text-muted">{t("time.minutes", { count: match.durationMinutes })}</Text>
        </View>

        <View className="min-w-0 flex-1 gap-2">
          <View className="flex-row items-center justify-between gap-2">
            <Text numberOfLines={1} className="flex-1 font-bold text-[16px] text-foreground">
              {match.clubName}
            </Text>
            <LevelRangeChip min={match.levelMin} max={match.levelMax} outOfRange={!playable} />
          </View>

          {playable ? (
            <>
              <View className="flex-row items-center justify-between">
                <View className="flex-row">
                  {match.players.map((player, index) => (
                    <PlayerAvatar
                      key={player.id}
                      player={player}
                      size={30}
                      tintIndex={tintIndices[index]}
                      ringClassName="border-surface"
                      className={index > 0 ? "-ms-2" : undefined}
                    />
                  ))}
                </View>
                <Text className="font-normal text-[13px] text-muted">
                  <Text className="font-bold text-foreground">{spotsLabel}</Text>
                  {priceLabel ? ` · ${priceLabel}` : ""}
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Icon as={Check} size={14} color="success" />
                <Text className="font-bold text-[12px] text-success">{note}</Text>
              </View>
            </>
          ) : (
            <>
              <Text className="font-normal text-[13px] leading-[18px] text-muted">{note}</Text>
              <Button
                size="sm"
                variant="outline"
                onPress={onAskToJoin}
                hitSlop={5}
                className="h-[34px] self-start rounded-xl px-3.5"
              >
                {t("matchItem.askToJoin")}
              </Button>
            </>
          )}
        </View>
      </View>
    </PressableFeedback>
  );
}
