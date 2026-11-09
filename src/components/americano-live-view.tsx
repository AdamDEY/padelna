import { Button, cn, Spinner } from "heroui-native";
import { ArrowLeftRight, ChevronDown, ChevronUp, Share as ShareIcon } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Share, Text, View } from "react-native";

import { AmericanoScoreSheet, faceOf } from "@/components/americano-score-sheet";
import { Icon } from "@/components/icon";
import { IconButton } from "@/components/icon-button";
import { LoadError } from "@/components/load-error";
import { Page } from "@/components/page";
import { PlayerAvatar } from "@/components/player-avatar";
import { tournamentsKey, useTournamentLive } from "@/hooks/useTournaments";
import {
  americanoScoreText,
  canEnterScore,
  currentRound,
  fullName,
  leaderboard,
  lineUp,
  myMatches,
  myMatchIn,
  roundCount,
  roundsPlayed,
  scoreModeOf,
  shortName,
} from "@/lib/americano-live";
import { errorMessage } from "@/lib/error-message";
import { formatMatchDay } from "@/lib/format-date";
import { queryClient } from "@/lib/query-client";
import type { LiveEntry, LiveMatch, LiveTournament } from "@/types/tournament";

// The app's own link; there is no website to send people to yet
const TOURNAMENT_LINK = "padelna:///tournament/";
// Leaderboard rows before "See all N players" (design "Americano live")
const LEADERS_SHOWN = 8;
const FACE_SIZE = 40;
const FACE_OVERLAP = 13;

function refresh() {
  return queryClient.refetchQueries({ queryKey: tournamentsKey });
}

/** An individual Americano once it has started (design "Americano live · round, leaderboard"). */
export function AmericanoLiveView({ id }: { id: string }) {
  const { t } = useTranslation();
  const query = useTournamentLive(id);
  const tournament = query.data;

  if (query.isPending) {
    return (
      <Page>
        <Page.Header back />
        <Page.Body scroll={false} className="items-center justify-center">
          <Spinner accessibilityLabel={t("tournaments.loading")} />
        </Page.Body>
      </Page>
    );
  }
  if (!tournament) {
    return (
      <Page>
        <Page.Header back />
        <Page.Body>
          {query.error ? (
            <LoadError
              message={t("tournaments.detail.loadFailed", { message: errorMessage(query.error) })}
              onRetry={() => query.refetch()}
              isRetrying={query.isRefetching}
            />
          ) : (
            <Page.Title description={t("tournaments.detail.notFoundText")}>{t("tournaments.detail.notFound")}</Page.Title>
          )}
        </Page.Body>
      </Page>
    );
  }
  return <LiveScreen tournament={tournament} />;
}

function LiveScreen({ tournament }: { tournament: LiveTournament }) {
  const { t } = useTranslation();
  const [scoring, setScoring] = useState<LiveMatch>();
  const [showAll, setShowAll] = useState(false);

  const mode = scoreModeOf(tournament);
  const total = roundCount(tournament);
  const round = currentRound(tournament);
  const played = roundsPlayed(tournament);
  const isFinished = tournament.status === "finished";
  const current = isFinished ? undefined : myMatchIn(tournament, round);
  const next = isFinished ? undefined : myMatchIn(tournament, round + 1);
  const rows = leaderboard(tournament);
  const shownRows = showAll ? rows : rows.slice(0, LEADERS_SHOWN);
  const mine = myMatches(tournament).filter((match) => match.score);
  const subtitle = [tournament.startsAt ? formatMatchDay(tournament.startsAt) : undefined, tournament.clubName].filter(Boolean).join(" · ");

  function share() {
    Share.share({ message: `${[tournament.name, subtitle].filter(Boolean).join(" · ")}\n${TOURNAMENT_LINK}${tournament.id}` });
  }

  return (
    <Page>
      <Page.Header
        back
        leading={
          <View>
            <Text accessibilityRole="header" numberOfLines={1} className="font-black text-[18px] text-foreground">
              {tournament.name}
            </Text>
            {subtitle ? <Text numberOfLines={1} className="font-normal text-[13px] text-muted">{subtitle}</Text> : null}
          </View>
        }
      >
        <IconButton icon={ShareIcon} label={t("tournaments.detail.share")} onPress={share} />
      </Page.Header>

      <Page.Body onRefresh={refresh} className="gap-4">
        <View className="flex-row flex-wrap gap-1.5">
          {isFinished ? (
            <View className="rounded-[10px] bg-success-soft px-2.5 py-1">
              <Text className="font-black text-[12px] text-success-soft-foreground">{t("tournaments.live.finished")}</Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-[7px] rounded-[10px] bg-danger-soft py-1 pe-2.5 ps-[9px]">
              <View className="size-2 rounded-full bg-danger" />
              <Text className="font-black text-[12px] uppercase tracking-[0.4px] text-danger-soft-foreground">
                {t("tournaments.americano.liveRound", { round, total })}
              </Text>
            </View>
          )}
          <View className="rounded-[10px] bg-primary-soft px-2.5 py-1">
            <Text className="font-bold text-[12px] text-primary-dark">{t("tournaments.entry.individual")}</Text>
          </View>
          <View className="rounded-[10px] bg-out-of-range px-2.5 py-1">
            <Text className="font-bold text-[12px] text-ink-2">{t("tournaments.americano.players", { count: tournament.entries.length })}</Text>
          </View>
        </View>

        {/* One segment per round: played, being played, still to come */}
        <View className="gap-1.5" accessible accessibilityLabel={t("tournaments.americano.roundsPlayed", { count: played })}>
          <View className="flex-row gap-1">
            {Array.from({ length: total }, (_, index) => (
              <View
                key={index}
                className={cn(
                  "h-1.5 flex-1 rounded-[3px]",
                  index < played ? "bg-success-soft-foreground" : index === played && !isFinished ? "bg-accent" : "bg-line-input",
                )}
              />
            ))}
          </View>
          <Text className="font-bold text-[12px] text-muted">{t("tournaments.americano.roundsPlayed", { count: played })}</Text>
        </View>

        {current ? (
          <CurrentRoundCard tournament={tournament} match={current} onEnterScore={() => setScoring(current)} />
        ) : null}

        {next ? <NextRoundCard tournament={tournament} match={next} /> : null}

        <View className="gap-0.5 rounded-[20px] border border-line bg-surface px-2.5 pb-2.5 pt-3.5">
          <View className="flex-row items-baseline justify-between px-2.5 pb-2">
            <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">{t("tournaments.americano.leaderboard")}</Text>
            <Text className="font-normal text-[13px] text-muted">{t(`tournaments.americano.scoredLabel.${mode}`)}</Text>
          </View>
          {shownRows.map((row) => (
            <LeaderRowView key={row.entry.id} tournament={tournament} entry={row.entry} rank={row.rank} scored={row.scored} moved={row.moved} />
          ))}
          {!showAll && rows.length > LEADERS_SHOWN ? (
            <Button variant="outline" onPress={() => setShowAll(true)} className="mx-2.5 mb-1 mt-2 h-11 rounded-[14px] border-line-input bg-surface">
              <Button.Label className="font-bold text-[14px] text-foreground">{t("tournaments.americano.seeAll", { count: rows.length })}</Button.Label>
            </Button>
          ) : null}
        </View>

        {mine.length > 0 ? (
          <View className="rounded-[20px] border border-line bg-surface px-4 pb-1.5 pt-3.5">
            <Text accessibilityRole="header" className="pb-1.5 font-black text-[17px] text-foreground">{t("tournaments.americano.yourRounds")}</Text>
            {mine.map((match) => {
              const { partner, opponents } = lineUp(tournament, match);
              return (
                <View key={match.id} className="flex-row items-center gap-2.5 border-t border-fill py-2.5">
                  <Text className="w-8 font-black text-[13px] text-foreground">{t("tournaments.americano.roundShort", { round: match.round })}</Text>
                  <Text className="flex-1 font-normal text-[13px] text-foreground">
                    {t("tournaments.americano.withPartner", { name: shortName(partner) })}{" "}
                    <Text className="text-muted">{t("tournaments.americano.versus", { names: opponents.map(shortName).join(" + ") })}</Text>
                  </Text>
                  <Text className="font-black text-[13px] text-foreground" style={{ fontVariant: ["tabular-nums"] }}>
                    {match.score ? americanoScoreText(mode, match.score, match.mySide) : "—"}
                  </Text>
                  {canEnterScore(tournament, match) ? (
                    <Button size="sm" variant="ghost" onPress={() => setScoring(match)} accessibilityLabel={t("tournaments.americano.correctA11y", { round: match.round })}>
                      <Button.Label className="text-accent">{t("tournaments.americano.correct")}</Button.Label>
                    </Button>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
      </Page.Body>

      <AmericanoScoreSheet tournament={tournament} match={scoring} onClose={() => setScoring(undefined)} />
    </Page>
  );
}

/** My match this round: partner, opponents and the button to enter points */
function CurrentRoundCard({ tournament, match, onEnterScore }: { tournament: LiveTournament; match: LiveMatch; onEnterScore: () => void }) {
  const { t } = useTranslation();
  const mode = scoreModeOf(tournament);
  const { partner, opponents } = lineUp(tournament, match);
  const me = tournament.entries.find((entry) => entry.id === tournament.myEntryId);

  return (
    <View className="gap-3.5 rounded-3xl bg-accent p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="font-bold text-[12px] uppercase tracking-[0.8px] text-primary-tint-text">
          {t("tournaments.americano.roundOnly", { round: match.round })}
        </Text>
        {match.score ? (
          <View className="rounded-[10px] bg-lime px-2.5 py-1">
            <Text className="font-bold text-[12px] text-lime-foreground">{americanoScoreText(mode, match.score, match.mySide)}</Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row items-center gap-2 rounded-2xl bg-white/10 p-3">
        <Side
          entries={[me, partner]}
          name={[t("common.you"), shortName(partner)].filter(Boolean).join(" + ")}
          note={t("tournaments.americano.partnerThisRound")}
        />
        <Text className="font-black text-[12px] text-primary-tint-text">{t("tournaments.live.vs")}</Text>
        <Side entries={opponents} name={opponents.map(shortName).join(" + ")} />
      </View>

      <Button variant="secondary" onPress={onEnterScore} className="bg-surface">
        <Button.Label className="text-accent">
          {match.score ? t("tournaments.americano.correctPoints") : t("tournaments.americano.enterPointsWhenDone")}
        </Button.Label>
      </Button>
    </View>
  );
}

function Side({ entries, name, note }: { entries: (LiveEntry | undefined)[]; name: string; note?: string }) {
  return (
    <View className="flex-1 items-center gap-1.5">
      <View className="flex-row">
        {entries
          .filter((entry): entry is LiveEntry => !!entry)
          .map((entry, index) => (
            <View key={entry.id} style={index > 0 ? { marginStart: -FACE_OVERLAP } : undefined}>
              <PlayerAvatar player={faceOf(entry)} size={FACE_SIZE} ringClassName="border-accent" />
            </View>
          ))}
      </View>
      <Text numberOfLines={2} className="text-center font-bold text-[13px] text-white">
        {name}
      </Text>
      {note ? <Text className="font-normal text-[11px] text-primary-tint-text">{note}</Text> : null}
    </View>
  );
}

function NextRoundCard({ tournament, match }: { tournament: LiveTournament; match: LiveMatch }) {
  const { t } = useTranslation();
  const { partner, opponents } = lineUp(tournament, match);
  return (
    <View className="flex-row items-center gap-3 rounded-[18px] border border-line bg-surface p-3">
      <View className="size-10 items-center justify-center rounded-xl bg-primary-soft">
        <Icon as={ArrowLeftRight} size={20} color="primary-dark" />
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-[12px] text-muted">{t("tournaments.americano.nextRound", { round: match.round })}</Text>
        <Text className="font-bold text-[14px] text-foreground">{t("tournaments.americano.withPartner", { name: shortName(partner) })}</Text>
        <Text className="font-normal text-[12px] text-muted">{t("tournaments.americano.versus", { names: opponents.map(shortName).join(" + ") })}</Text>
      </View>
    </View>
  );
}

const MEDAL_BG = ["bg-lime", "bg-lime-soft", "bg-lime-soft"] as const;

function LeaderRowView({ tournament, entry, rank, scored, moved }: { tournament: LiveTournament; entry: LiveEntry; rank: number; scored: number; moved?: number }) {
  const { t } = useTranslation();
  const isMe = entry.id === tournament.myEntryId;
  const name = isMe ? t("common.you") : fullName(entry);

  return (
    <View
      accessible
      accessibilityLabel={t("tournaments.americano.rowA11y", { rank, name, points: scored })}
      className={cn("flex-row items-center gap-2.5 rounded-[14px] px-2.5 py-2", isMe && "bg-primary-soft")}
    >
      <View className={cn("size-[26px] items-center justify-center rounded-full", MEDAL_BG[rank - 1] ?? "bg-background")}>
        <Text className="font-black text-[12px] text-foreground">{rank}</Text>
      </View>
      <PlayerAvatar player={faceOf(entry)} size={32} ringClassName={isMe ? "border-primary-soft" : "border-surface"} />
      <Text numberOfLines={1} className="flex-1 font-bold text-[14px] text-foreground">
        {name}
      </Text>
      <View className="w-[34px] flex-row items-center justify-end">
        {moved === undefined ? null : moved === 0 ? (
          <Text className="font-bold text-[12px] text-muted">–</Text>
        ) : (
          <>
            <Icon as={moved > 0 ? ChevronUp : ChevronDown} size={14} color={moved > 0 ? "success-soft-foreground" : "attention-action"} />
            <Text className={cn("font-bold text-[11px]", moved > 0 ? "text-success-soft-foreground" : "text-attention-action")}>{Math.abs(moved)}</Text>
          </>
        )}
      </View>
      <Text className="w-[34px] text-right font-black text-[16px] text-foreground" style={{ fontVariant: ["tabular-nums"] }}>
        {scored}
      </Text>
    </View>
  );
}
