import { Button, cn } from "heroui-native";
import { Share as ShareIcon, Trophy } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View, type LayoutChangeEvent } from "react-native";

import { faceOf } from "@/components/americano-score-sheet";
import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import { TournamentFaces } from "@/components/tournament-faces";
import { TournamentHero } from "@/components/tournament-hero";
import { fullName, scoreModeOf } from "@/lib/americano-live";
import { formatMatchDay } from "@/lib/format-date";
import { isPodium, placeText, type AmericanoRecap, type RoundStep } from "@/lib/tournament-history";
import { entryName } from "@/lib/tournament-live";
import type { LiveEntry, LiveTournament } from "@/types/tournament";

// design: six rows, then "See all 16 players"
const LEADERS_SHOWN = 6;

const MEDAL_BG = ["bg-lime", "bg-lime-soft", "bg-lime-soft"] as const;
const MEDAL_TEXT = ["text-on-lime", "text-lime-foreground", "text-lime-foreground"] as const;

type AmericanoRecapViewProps = {
  tournament: LiveTournament;
  recap: AmericanoRecap;
  myId?: string;
  onBack: () => void;
  onHeroLayout: (event: LayoutChangeEvent) => void;
  onShare: () => void;
};

/** A finished Americano: my place, the leaderboard and each of my rounds (design "Americano recap · finished"). */
export function AmericanoRecapView({ tournament, recap, myId, onBack, onHeroLayout, onShare }: AmericanoRecapViewProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const mode = scoreModeOf(tournament);
  const isPairs = tournament.entryMode === "pairs";
  const onPodium = isPodium(recap);

  const subtitle = [
    tournament.startsAt ? formatMatchDay(tournament.startsAt) : undefined,
    tournament.clubName,
    t(isPairs ? "tournamentRecap.pairsCount" : "tournamentRecap.playersCount", { count: recap.total }),
  ]
    .filter(Boolean)
    .join(" · ");

  // Show my row too when I'm below the shown ones
  const mine = recap.rows.find((row) => row.entry.id === tournament.myEntryId);
  const firstRows = showAll ? recap.rows : recap.rows.slice(0, LEADERS_SHOWN);
  const rows = mine && !firstRows.includes(mine) ? [...firstRows, mine] : firstRows;

  return (
    <>
      <View onLayout={onHeroLayout}>
        <TournamentHero
          title={tournament.name}
          subtitle={subtitle}
          chips={[
            { label: t("tournamentRecap.finished"), tone: "glass" },
            {
              label: t(isPairs ? "tournamentHistory.kind.americanoPairs" : "tournamentHistory.kind.americanoIndividual"),
              tone: "soft",
            },
          ]}
          stats={[
            {
              value: recap.rank !== undefined ? placeText(recap.rank) : "–",
              label: t(isPairs ? "tournamentRecap.placeOfPairs" : "tournamentRecap.placeOfPlayers", { count: recap.total }),
              accent: onPodium,
            },
            { value: String(recap.points), label: t("tournamentRecap.points") },
            { value: `${recap.roundsWon} – ${recap.roundsLost}`, label: t("tournamentRecap.roundsWon") },
          ]}
          onBack={onBack}
        />
      </View>

      <View className="gap-4 px-5">
        {recap.best ? <BestRound best={recap.best} onPodium={onPodium} /> : null}

        <View className="gap-0.5 rounded-[20px] border border-line bg-surface px-2.5 pb-2.5 pt-3.5">
          <View className="flex-row items-baseline justify-between px-2.5 pb-2">
            <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
              {t("tournamentRecap.finalLeaderboard")}
            </Text>
            <Text className="font-normal text-[13px] text-muted">{t(`tournaments.americano.scoredLabel.${mode}`)}</Text>
          </View>
          {rows.map((row) => (
            <LeaderRowView
              key={row.entry.id}
              entry={row.entry}
              rank={row.rank}
              points={row.scored}
              isMe={row.entry.id === tournament.myEntryId}
              isPairs={isPairs}
              myEntryId={tournament.myEntryId}
              myId={myId}
            />
          ))}
          {!showAll && recap.rows.length > LEADERS_SHOWN ? (
            <Button
              variant="outline"
              onPress={() => setShowAll(true)}
              className="mx-2.5 mb-1 mt-2 h-[42px] rounded-[14px] border-line-input bg-surface"
            >
              <Button.Label className="font-bold text-[14px] text-foreground">
                {t(isPairs ? "tournamentRecap.seeAllPairs" : "tournamentRecap.seeAll", { count: recap.rows.length })}
              </Button.Label>
            </Button>
          ) : null}
        </View>

        {recap.rounds.length > 0 ? (
          <View className="rounded-[20px] border border-line bg-surface px-4 pb-1.5 pt-3.5">
            <View className="flex-row items-baseline justify-between pb-1">
              <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
                {t("tournamentRecap.yourRounds", { count: recap.rounds.length })}
              </Text>
              <Text className="font-normal text-[13px] text-muted">{t("tournamentRecap.pointsCount", { count: recap.points })}</Text>
            </View>
            {recap.rounds.map((round) => (
              <View key={round.match.id} className="flex-row items-center gap-2.5 border-t border-fill py-[9px]">
                <Text className="w-[26px] font-black text-[13px] text-foreground">
                  {t("tournaments.americano.roundShort", { round: round.match.round })}
                </Text>
                <Text className="flex-1 font-normal text-[13px] text-foreground">
                  {t("tournaments.americano.withPartner", { name: round.partner })}{" "}
                  <Text className="text-muted">{t("tournaments.americano.versus", { names: round.opponents })}</Text>
                </Text>
                <Text
                  className={cn("font-black text-[13px]", round.won ? "text-success-soft-foreground" : "text-foreground")}
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {round.score}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Button variant="secondary" onPress={onShare} className="h-12 rounded-2xl">
          <Icon as={ShareIcon} size={18} color="primary-dark" />
          <Button.Label className="text-[14px] text-primary-dark">{t("tournamentRecap.share")}</Button.Label>
        </Button>
      </View>
    </>
  );
}

function BestRound({ best, onPodium }: { best: RoundStep; onPodium: boolean }) {
  const { t } = useTranslation();
  const text = t("tournamentRecap.bestRoundText", { round: best.match.round, partner: best.partner, score: best.score });

  return (
    <View
      accessible
      className={cn("flex-row items-center gap-3 rounded-[20px] p-3.5", onPodium ? "bg-lime-soft" : "bg-primary-soft")}
    >
      <View className={cn("size-11 items-center justify-center rounded-[14px]", onPodium ? "bg-lime" : "bg-surface")}>
        <Icon as={Trophy} size={22} color={onPodium ? "on-lime" : "primary-dark"} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className={cn("font-bold text-[15px]", onPodium ? "text-foreground" : "text-primary-dark")}>
          {t(onPodium ? "tournamentRecap.onThePodium" : "tournamentRecap.bestRound")}
        </Text>
        <Text className={cn("font-normal text-[13px]", onPodium ? "text-lime-foreground" : "text-primary-dark")}>
          {onPodium ? t("tournamentRecap.bestRoundLine", { round: best.match.round, partner: best.partner, score: best.score }) : text}
        </Text>
      </View>
    </View>
  );
}

function LeaderRowView({
  entry,
  rank,
  points,
  isMe,
  isPairs,
  myEntryId,
  myId,
}: {
  entry: LiveEntry;
  rank: number;
  points: number;
  isMe: boolean;
  isPairs: boolean;
  myEntryId?: string;
  myId?: string;
}) {
  const { t } = useTranslation();
  // A pair is named by both players ("You + Karim"); alone, by the one player
  const name = isPairs ? entryName(entry, myEntryId, myId) : isMe ? t("common.you") : fullName(entry);

  return (
    <View
      accessible
      accessibilityLabel={t("tournamentRecap.rowA11y", { rank, name, points })}
      className={cn("flex-row items-center gap-2.5 rounded-[14px] px-2.5 py-2", isMe && "bg-primary-soft")}
    >
      <View className={cn("size-[26px] items-center justify-center rounded-full", MEDAL_BG[rank - 1] ?? "bg-background")}>
        <Text className={cn("font-black text-[12px]", MEDAL_TEXT[rank - 1] ?? "text-foreground")}>{rank}</Text>
      </View>
      {isPairs ? (
        <TournamentFaces entry={entry} size={26} ringClassName={isMe ? "border-primary-soft" : "border-surface"} overlap={6} />
      ) : (
        <PlayerAvatar player={faceOf(entry)} size={32} />
      )}
      <Text numberOfLines={1} className="flex-1 font-bold text-[14px] text-foreground">
        {name}
      </Text>
      <Text className="font-black text-[16px] text-foreground" style={{ fontVariant: ["tabular-nums"] }}>
        {points}
      </Text>
    </View>
  );
}
