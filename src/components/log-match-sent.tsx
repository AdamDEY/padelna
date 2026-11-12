import { cn } from "heroui-native";
import { Send } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { teamName } from "@/components/score-grid";
import { formatMatchDay } from "@/lib/format-date";
import { winningTeam, type SetScore } from "@/lib/padel-score";
import type { Player } from "@/types/player";

// design: 34 px score boxes on the blue card
const BOX_SIZE = 34;

type LogMatchSentProps = {
  clubName: string;
  startsAt: Date;
  /** Seat order: you, your partner, then the two opponents */
  seats: Player[];
  sets: SetScore[];
  myId: string;
};

/**
 * What a logged match looks like once it's sent (design: LogMatchSent): the score on a blue
 * card and who still has to confirm it. The screen adds the header and the Done button.
 */
export function LogMatchSent({ clubName, startsAt, seats, sets, myId }: LogMatchSentProps) {
  const { t } = useTranslation();
  const teams = [seats.slice(0, 2), seats.slice(2, 4)];
  const winner = winningTeam(sets);

  return (
    <View className="gap-3.5">
      <View className="items-center gap-2 pt-2">
        <View className="size-16 items-center justify-center rounded-full bg-primary-soft">
          <Icon as={Send} size={32} color="accent-text" />
        </View>
        <Text accessibilityRole="header" className="text-center font-black text-[24px] text-foreground">
          {t("logMatch.sentTitle")}
        </Text>
        <Text className="text-center font-normal text-[15px] leading-[22px] text-muted">
          {t("logMatch.sentText")}
        </Text>
      </View>

      <View className="gap-2 rounded-[20px] bg-accent p-3.5">
        <View className="flex-row justify-between gap-3">
          <Text numberOfLines={1} className="shrink font-bold text-[12px] uppercase tracking-[0.6px] text-primary-tint-text">
            {clubName}
          </Text>
          <Text className="font-bold text-[12px] uppercase tracking-[0.6px] text-primary-tint-text">
            {formatMatchDay(startsAt)}
          </Text>
        </View>
        {teams.map((team, index) => {
          const isWinner = winner === index + 1;
          return (
            <View key={index} className="flex-row items-center gap-1.5">
              <Text
                numberOfLines={1}
                className={cn(
                  "flex-1 text-[14px]",
                  isWinner ? "font-black text-accent-foreground" : "font-semibold text-primary-tint-text",
                )}
              >
                {teamName(team, myId)}
              </Text>
              {sets.map((set, setIndex) => (
                <View
                  key={setIndex}
                  style={{ width: BOX_SIZE, height: BOX_SIZE }}
                  className={cn(
                    "items-center justify-center rounded-[10px]",
                    isWinner ? "bg-surface" : "bg-white/15",
                  )}
                >
                  <Text
                    className={cn(
                      "text-[18px]",
                      isWinner ? "font-black text-foreground" : "font-bold text-accent-foreground",
                    )}
                  >
                    {set[index]}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}
      </View>

      <View className="rounded-[20px] border border-line bg-surface px-3.5 py-1.5">
        {seats.map((player, index) => {
          const isMe = player.id === myId;
          return (
            <View key={player.id} className="flex-row items-center gap-3 py-[7px]">
              <PlayerAvatar player={player} size={38} />
              <Text numberOfLines={1} className="flex-1 font-bold text-[15px] text-foreground">
                {isMe ? t("common.you") : shortNameOf(player)}
              </Text>
              {index < 2 ? (
                <Text className="font-bold text-[12px] text-muted">
                  {isMe ? t("logMatch.loggedByYou") : t("logMatch.yourTeam")}
                </Text>
              ) : (
                <Text className="overflow-hidden rounded-[9px] bg-warning-soft px-2 py-[3px] font-bold text-[12px] text-warning">
                  {t("logMatch.waiting")}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <Text className="text-center font-normal text-[13px] text-muted">{t("logMatch.expires")}</Text>
    </View>
  );
}
