import { cn, PressableFeedback } from "heroui-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { entryById, entryName, scoreText, waitingFor } from "@/lib/tournament-live";
import type { LiveMatch, LiveTournament } from "@/types/tournament";

const chipTones = {
  confirmed: { bg: "bg-success-soft", fg: "text-success-soft-foreground" },
  waiting: { bg: "bg-warning-soft", fg: "text-warning-soft-foreground" },
  next: { bg: "bg-primary-soft", fg: "text-primary-dark" },
  later: { bg: "bg-out-of-range", fg: "text-ink-2" },
} as const;

type MatchState = keyof typeof chipTones;

type TournamentMatchRowProps = {
  tournament: LiveTournament;
  match: LiveMatch;
  /** What the left column says: the group round, or the knockout match name */
  caption: string;
  myId?: string;
  isNext?: boolean;
  /** Set when I can send this match's score */
  onEnterScore?: () => void;
};

/** A match in a list: round, both pairs (mine in bold), score and where it stands. */
export function TournamentMatchRow({ tournament, match, caption, myId, isNext = false, onEnterScore }: TournamentMatchRowProps) {
  const { t } = useTranslation();
  const { myEntryId } = tournament;
  const one = entryById(tournament, match.entry1Id);
  const two = entryById(tournament, match.entry2Id);
  const name1 = one ? entryName(one, myEntryId, myId) : waitingFor(tournament, match, 1);
  const name2 = two ? entryName(two, myEntryId, myId) : waitingFor(tournament, match, 2);
  // My pair reads first, and the score from my side
  const side = match.mySide ?? 1;
  const [first, second] = side === 1 ? [name1, name2] : [name2, name1];
  const firstWon = match.winnerEntryId !== undefined && match.winnerEntryId === (side === 1 ? match.entry1Id : match.entry2Id);

  const state: MatchState = match.score ? "confirmed" : match.submitted ? "waiting" : isNext ? "next" : "later";
  const shown = match.score ?? match.submitted;
  const score = shown ? scoreText(shown, side) : "—";

  const content = (
    <View className="flex-row items-center gap-2.5 border-t border-fill py-2.5">
      <Text numberOfLines={2} className="w-[60px] font-bold text-[12px] text-ink-2">
        {caption}
      </Text>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text numberOfLines={1} className={cn("text-[13px]", match.mySide ? "font-black text-foreground" : firstWon ? "font-bold text-foreground" : "font-normal text-foreground")}>
          {first}
        </Text>
        <Text numberOfLines={1} className={cn("text-[13px]", match.score && !firstWon ? "font-bold text-foreground" : "font-normal text-muted")}>
          {second}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text className="font-black text-[14px] text-foreground" style={{ fontVariant: ["tabular-nums"] }}>
          {score}
        </Text>
        {onEnterScore && !match.submitted ? (
          <Text className="font-bold text-[12px] text-accent">{t("tournaments.live.enterScore")}</Text>
        ) : (
          <View className={cn("rounded-[7px] px-[7px] py-0.5", chipTones[state].bg)}>
            <Text className={cn("font-bold text-[11px]", chipTones[state].fg)}>{t(`tournaments.live.matchState.${state}`)}</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (!onEnterScore) return content;
  return (
    <PressableFeedback
      onPress={onEnterScore}
      accessibilityRole="button"
      accessibilityLabel={t("tournaments.live.matchA11y", { caption, first, second, score })}
      accessibilityHint={t("tournaments.live.enterScoreHint")}
    >
      {content}
    </PressableFeedback>
  );
}
