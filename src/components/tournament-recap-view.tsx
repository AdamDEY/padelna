import { Button, cn } from "heroui-native";
import { Share as ShareIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View, type LayoutChangeEvent } from "react-native";

import { Icon } from "@/components/icon";
import { TournamentFaces } from "@/components/tournament-faces";
import { TournamentGroupTable } from "@/components/tournament-group-table";
import { TournamentHero } from "@/components/tournament-hero";
import { formatMatchDay } from "@/lib/format-date";
import { placeText, type GroupsRecap, type PathStep, type Podium } from "@/lib/tournament-history";
import { entryName, scoreText } from "@/lib/tournament-live";
import type { Player } from "@/types/player";
import type { LiveEntry, LiveTournament } from "@/types/tournament";

// design: podium steps are 92 px for first, 64 for second and 44 for third
const STEP_HEIGHTS = { first: 92, second: 64, third: 44 } as const;
const STEP_TONES = {
  first: { box: "bg-lime", text: "text-lime-foreground" },
  second: { box: "bg-primary-soft", text: "text-primary-dark" },
  third: { box: "bg-out-of-range", text: "text-ink-2" },
} as const;

type TournamentRecapViewProps = {
  tournament: LiveTournament;
  recap: GroupsRecap;
  /** "3.5 – 5.0", when the tournament has a level range */
  levelRange?: string;
  /** The player I played with */
  partner?: Player;
  myId?: string;
  onBack: () => void;
  onHeroLayout: (event: LayoutChangeEvent) => void;
  onShare: () => void;
};

/** A finished group stage + knockout: my finish, the podium, my path and my group (design "Tournament recap · finished (groups + knockout)"). */
export function TournamentRecapView({
  tournament,
  recap,
  levelRange,
  partner,
  myId,
  onBack,
  onHeroLayout,
  onShare,
}: TournamentRecapViewProps) {
  const { t } = useTranslation();
  const name = (entry: LiveEntry | undefined) => entryName(entry, tournament.myEntryId, myId);
  const subtitle = [
    tournament.startsAt ? formatMatchDay(tournament.startsAt) : undefined,
    tournament.clubName,
    t("tournamentRecap.teamsCount", { count: tournament.entries.length }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <View onLayout={onHeroLayout}>
        <TournamentHero
          title={tournament.name}
          subtitle={subtitle}
          chips={[
            { label: t("tournamentRecap.finished"), tone: "glass" },
            { label: t("tournaments.format.groups"), tone: "lime" },
            ...(levelRange ? [{ label: t("tournamentRecap.levelRange", { range: levelRange }), tone: "glass" as const }] : []),
          ]}
          stats={[
            { value: t(`tournamentHistory.finish.${recap.finish}`), label: t("tournamentRecap.yourFinish"), accent: recap.finish === "winner" },
            { value: `${recap.matchesWon} – ${recap.matchesLost}`, label: t("tournamentRecap.matchesWon") },
            { value: `${recap.setsWon} – ${recap.setsLost}`, label: t("tournamentRecap.setsWon") },
          ]}
          onBack={onBack}
        />
      </View>

      <View className="gap-4 px-5">
        {recap.podium.first ? <PodiumCard podium={recap.podium} tournament={tournament} name={name} /> : null}

        {recap.path.length > 0 ? (
          <View className="rounded-[22px] border border-line bg-surface px-4 pb-1.5 pt-3.5">
            <View className="flex-row items-baseline justify-between pb-1.5">
              <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
                {t("tournamentRecap.yourPath")}
              </Text>
              {partner ? (
                <Text className="font-normal text-[12px] text-muted">
                  {t("tournamentRecap.withName", { name: `${partner.firstName} ${partner.lastName.charAt(0)}.` })}
                </Text>
              ) : null}
            </View>
            {recap.path.map((step) => (
              <PathRow key={step.match.id} step={step} name={name} />
            ))}
          </View>
        ) : null}

        {recap.group ? (
          <TournamentGroupTable
            label={recap.group.label}
            rows={recap.group.rows}
            myEntryId={tournament.myEntryId}
            myId={myId}
            caption={recap.group.myRank ? t("tournamentRecap.youFinished", { place: placeText(recap.group.myRank) }) : undefined}
          />
        ) : null}

        <Button variant="secondary" onPress={onShare} className="h-12 rounded-2xl">
          <Icon as={ShareIcon} size={18} color="primary-dark" />
          <Button.Label className="text-[14px] text-primary-dark">{t("tournamentRecap.share")}</Button.Label>
        </Button>
      </View>
    </>
  );
}

function PodiumCard({
  podium,
  tournament,
  name,
}: {
  podium: Podium;
  tournament: LiveTournament;
  name: (entry: LiveEntry | undefined) => string;
}) {
  const { t } = useTranslation();
  // Silver on the left, gold in the middle, bronze on the right
  const steps = [
    { key: "second", place: 2, entry: podium.second },
    { key: "first", place: 1, entry: podium.first },
    { key: "third", place: 3, entry: podium.third },
  ] as const;

  return (
    <View className="gap-3.5 rounded-[22px] border border-line bg-surface p-4">
      <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
        {t("tournamentRecap.finalStandings")}
      </Text>
      <View className="flex-row items-end gap-2">
        {steps.map(({ key, place, entry }) =>
          entry ? (
            <View key={key} className="flex-1 items-center gap-1.5">
              <TournamentFaces entry={entry} size={34} ringClassName="border-surface" overlap={7} />
              <Text numberOfLines={2} className="text-center font-bold text-[12px] leading-[15px] text-foreground">
                {name(entry).replace(" + ", " +\n")}
              </Text>
              <View
                className={cn("items-center self-stretch rounded-t-xl pt-2", STEP_TONES[key].box)}
                style={{ height: STEP_HEIGHTS[key] }}
              >
                <Text className={cn("font-black text-[18px]", STEP_TONES[key].text)}>{place}</Text>
              </View>
            </View>
          ) : (
            <View key={key} className="flex-1" />
          ),
        )}
      </View>
      {podium.sharedThird ? (
        <Text className="text-center font-normal text-[12px] text-muted">
          {t("tournamentRecap.thirdShared", { name: entryName(podium.sharedThird, tournament.myEntryId) })}
        </Text>
      ) : null}
    </View>
  );
}

function PathRow({ step, name }: { step: PathStep; name: (entry: LiveEntry | undefined) => string }) {
  const { t } = useTranslation();
  const { match } = step;
  const label = step.stage
    ? t(`tournamentRecap.stage.${step.stage}`)
    : t("tournamentRecap.groupRound", { group: match.groupLabel, round: match.round });
  const score = scoreText(step.score);

  return (
    <View
      accessible
      accessibilityLabel={[step.won ? t("tournamentRecap.result.won") : t("tournamentRecap.result.lost"), label, t("tournamentRecap.versus", { names: name(step.opponent) }), score].join(", ")}
      className="flex-row items-center gap-3 border-t border-fill py-2.5"
    >
      <View className={cn("size-8 items-center justify-center rounded-[10px]", step.won ? "bg-lime-soft" : "bg-attention-soft")}>
        <Text className={cn("font-black text-[13px]", step.won ? "text-lime-foreground" : "text-attention")}>
          {step.won ? t("tournamentRecap.result.won") : t("tournamentRecap.result.lost")}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-[12px] text-muted">{label}</Text>
        <Text numberOfLines={1} className="font-bold text-[14px] text-foreground">
          {t("tournamentRecap.versus", { names: name(step.opponent) })}
        </Text>
      </View>
      <Text className="font-bold text-[14px] text-foreground" style={{ fontVariant: ["tabular-nums"] }}>
        {score}
      </Text>
    </View>
  );
}
