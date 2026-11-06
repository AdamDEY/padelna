import { BottomSheet, Button, cn } from "heroui-native";
import { Info } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import { teamName } from "@/components/score-grid";
import { formatMatchDay } from "@/lib/format-date";
import { winningTeam } from "@/lib/padel-score";
import type { MatchDetails, MatchScore } from "@/types/match";
import type { Player } from "@/types/player";

// design: 30 px set columns
const SET_WIDTH = 30;

type LogMatchConfirmSheetProps = {
  match: MatchDetails & { score: MatchScore };
  myId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** "Something's wrong": enter the real score instead */
  onCorrect: () => void;
  isConfirming: boolean;
};

/**
 * Shown to a tagged opponent when they open a match someone logged with them (design:
 * LogMatchConfirm): the score to check, then confirm it or enter the real one.
 */
export function LogMatchConfirmSheet({
  match,
  myId,
  isOpen,
  onOpenChange,
  onConfirm,
  onCorrect,
  isConfirming,
}: LogMatchConfirmSheetProps) {
  const { t } = useTranslation();
  const seats = match.seats ?? match.players;
  const teams = [seats.slice(0, 2), seats.slice(2, 4)].map((team) =>
    team.filter((player): player is Player => player !== undefined),
  );
  const winner = winningTeam(match.score.sets);
  const sender = seats.find((player) => player?.id === match.score.submittedBy) ?? match.host;

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          contentContainerClassName="gap-3.5 px-5 pb-[34px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          <View className="flex-row items-center gap-3">
            {sender ? <PlayerAvatar player={sender} size={48} /> : null}
            <View className="flex-1">
              <BottomSheet.Title className="font-black text-[19px] leading-6 text-foreground">
                {t("logMatch.confirmTitle", { name: sender?.firstName ?? t("notifications.someone") })}
              </BottomSheet.Title>
              <BottomSheet.Description className="font-normal text-[13px] text-muted">
                {t("logMatch.confirmText")}
              </BottomSheet.Description>
            </View>
          </View>

          <View className="gap-2 rounded-[18px] bg-background px-3.5 py-3">
            <View className="flex-row justify-between gap-3">
              <Text numberOfLines={1} className="shrink font-bold text-[12px] text-muted">
                {[match.clubName, match.courtName].filter(Boolean).join(" · ")}
              </Text>
              <Text className="font-bold text-[12px] text-muted">{formatMatchDay(match.startsAt)}</Text>
            </View>
            {teams.map((team, index) => {
              const isWinner = winner === index + 1;
              return (
                <View key={index} className="flex-row items-center gap-1.5">
                  <Text
                    numberOfLines={1}
                    className={cn("flex-1 text-[14px]", isWinner ? "font-black text-foreground" : "font-bold text-ink-2")}
                  >
                    {teamName(team, myId)}
                  </Text>
                  {match.score.sets.map((set, setIndex) => (
                    <Text
                      key={setIndex}
                      style={{ width: SET_WIDTH }}
                      className={cn(
                        "text-center text-[17px]",
                        set[index] > set[1 - index] ? "font-black text-foreground" : "font-bold text-muted",
                      )}
                    >
                      {set[index]}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>

          <View className="flex-row gap-2.5 rounded-[14px] bg-primary-soft px-3 py-2.5">
            <View className="pt-0.5">
              <Icon as={Info} size={18} color="primary-dark" />
            </View>
            <Text className="flex-1 font-normal text-[13px] leading-[18px] text-primary-dark">
              {t("logMatch.confirmInfo")}
            </Text>
          </View>

          <View className="gap-2.5">
            <Button size="lg" onPress={onConfirm} isDisabled={isConfirming}>
              {t("logMatch.confirm")}
            </Button>
            <Button
              variant="outline"
              onPress={onCorrect}
              className="h-12 rounded-2xl border-attention-outline bg-surface"
            >
              <Button.Label className="text-attention-action">{t("logMatch.somethingWrong")}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
