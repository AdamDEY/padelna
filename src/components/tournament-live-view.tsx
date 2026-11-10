import { Button, cn, Spinner } from "heroui-native";
// import { Share as ShareIcon } from "lucide-react-native"; // Share button hidden for now
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

// import { IconButton } from "@/components/icon-button"; // Share button hidden for now
import { LoadError } from "@/components/load-error";
import { Page } from "@/components/page";
import { PlayerAvatar } from "@/components/player-avatar";
import { TournamentGroupTable } from "@/components/tournament-group-table";
import { TournamentMatchRow } from "@/components/tournament-match-row";
import { TournamentScoreSheet } from "@/components/tournament-score-sheet";
import { TournamentStageSteps } from "@/components/tournament-stage-steps";
import { useMyProfile } from "@/hooks/useMyProfile";
import { tournamentsKey, useTournamentLive } from "@/hooks/useTournaments";
import { errorMessage } from "@/lib/error-message";
import { formatMatchDay } from "@/lib/format-date";
import { queryClient } from "@/lib/query-client";
import {
  canSendScore,
  currentStage,
  entryById,
  entryName,
  groupRound,
  groupTables,
  knockoutRounds,
  matchTitle,
  myMatches,
  nextMatchOf,
  playersOf,
  scoreText,
  stagesOf,
  waitingFor,
} from "@/lib/tournament-live";
import type { LiveEntry, LiveMatch, LiveTournament } from "@/types/tournament";

type Tab = "mine" | "groups" | "bracket" | "teams";
const TABS: Tab[] = ["mine", "groups", "bracket", "teams"];

// The app's own link; there is no website to send people to yet
// const TOURNAMENT_LINK = "padelna:///tournament/"; // Share button hidden for now
const FACE_SIZE = 40;
const FACE_OVERLAP = 13;

function refresh() {
  return queryClient.refetchQueries({ queryKey: tournamentsKey });
}

type TournamentLiveViewProps = {
  id: string;
};

/** A tournament once it has started (designs "Tournament live · …"). */
export function TournamentLiveView({ id }: TournamentLiveViewProps) {
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
  const myId = useMyProfile().data?.player?.id;
  const [tab, setTab] = useState<Tab>(tournament.myEntryId ? "mine" : "groups");
  const [scoring, setScoring] = useState<LiveMatch>();

  const stage = currentStage(tournament);
  const round = groupRound(tournament);
  const isFinished = tournament.status === "finished";
  const subtitle = [tournament.startsAt ? formatMatchDay(tournament.startsAt) : undefined, tournament.clubName].filter(Boolean).join(" · ");

  // // Share button hidden for now
  // function share() {
  // Share.share({ message: `${[tournament.name, subtitle].filter(Boolean).join(" · ")}\n${TOURNAMENT_LINK}${tournament.id}` });
  // }

  const enterScore = (match: LiveMatch) => (canSendScore(tournament, match) ? () => setScoring(match) : undefined);

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
        {/* Share button hidden for now:
        <IconButton icon={ShareIcon} label={t("tournaments.detail.share")} onPress={share} /> */}
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
                {t("tournaments.live.liveStage", { stage: t(`tournaments.live.stageLong.${stage}`) })}
              </Text>
            </View>
          )}
          <View className="rounded-[10px] bg-out-of-range px-2.5 py-1">
            <Text className="font-bold text-[12px] text-ink-2">{t("tournaments.live.teamsCount", { count: tournament.entries.length })}</Text>
          </View>
          {stage === "groups" && round.total > 0 ? (
            <View className="rounded-[10px] bg-out-of-range px-2.5 py-1">
              <Text className="font-bold text-[12px] text-ink-2">{t("tournaments.live.roundOf", round)}</Text>
            </View>
          ) : null}
        </View>

        <TournamentStageSteps stages={stagesOf(tournament)} current={stage} />

        <View accessibilityRole="tablist" className="flex-row gap-[22px] border-b border-line">
          {TABS.filter((item) => item !== "mine" || tournament.myEntryId).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item }}
              onPress={() => setTab(item)}
              className={cn("h-11 justify-center border-b-[3px]", tab === item ? "border-accent" : "border-transparent")}
            >
              <Text className={cn("text-[15px]", tab === item ? "font-bold text-foreground" : "font-semibold text-muted")}>
                {t(`tournaments.live.tab.${item}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "mine" ? (
          <MyTournament tournament={tournament} myId={myId} enterScore={enterScore} />
        ) : tab === "groups" ? (
          <View className="gap-3">
            {groupTables(tournament).map((group) => (
              <TournamentGroupTable key={group.label} label={group.label} rows={group.rows} myEntryId={tournament.myEntryId} myId={myId} />
            ))}
          </View>
        ) : tab === "bracket" ? (
          <Bracket tournament={tournament} myId={myId} enterScore={enterScore} />
        ) : (
          <Teams tournament={tournament} myId={myId} />
        )}
      </Page.Body>

      <TournamentScoreSheet tournament={tournament} match={scoring} myId={myId} onClose={() => setScoring(undefined)} />
    </Page>
  );
}

type SectionProps = {
  tournament: LiveTournament;
  myId?: string;
  enterScore: (match: LiveMatch) => (() => void) | undefined;
};

/** "My tournament": my next match, my group, my matches and the organiser's note */
function MyTournament({ tournament, myId, enterScore }: SectionProps) {
  const { t } = useTranslation();
  const next = nextMatchOf(tournament);
  const mine = entryById(tournament, tournament.myEntryId);
  const group = groupTables(tournament).find((table) => table.label === mine?.groupLabel);
  const matches = myMatches(tournament);

  return (
    <View className="gap-[18px]">
      {next ? (
        <NextMatchCard tournament={tournament} match={next} myId={myId} onEnterScore={enterScore(next)} />
      ) : (
        <View className="gap-1 rounded-[20px] border border-line bg-surface p-4">
          <Text className="font-black text-[15px] text-foreground">{t("tournaments.live.noNextTitle")}</Text>
          <Text className="font-normal text-[14px] text-muted">
            {tournament.status === "finished" ? t("tournaments.live.finishedText") : t("tournaments.live.noNextText")}
          </Text>
        </View>
      )}

      {group ? <TournamentGroupTable label={group.label} rows={group.rows} myEntryId={tournament.myEntryId} myId={myId} /> : null}

      {matches.length > 0 ? (
        <View className="rounded-[20px] border border-line bg-surface px-4 pb-1.5 pt-3.5">
          <View className="flex-row items-baseline justify-between pb-1.5">
            <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">{t("tournaments.live.myMatches")}</Text>
            <Text className="font-normal text-[13px] text-muted">
              {t("tournaments.live.played", { done: matches.filter((match) => match.score).length, total: matches.length })}
            </Text>
          </View>
          {matches.map((match) => (
            <TournamentMatchRow
              key={match.id}
              tournament={tournament}
              match={match}
              caption={match.stage === "group" ? t("tournaments.live.roundShort", { round: match.round }) : (match.label ?? "")}
              myId={myId}
              isNext={match.id === next?.id}
              onEnterScore={enterScore(match)}
            />
          ))}
        </View>
      ) : null}

      {tournament.notes ? (
        <View className="gap-2.5 rounded-[20px] border border-line bg-surface px-4 py-3.5">
          <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">{t("tournaments.live.fromOrganiser")}</Text>
          <Text className="font-normal text-[13px] leading-[19px] text-ink-2">
            {tournament.organiserName ? <Text className="font-bold text-foreground">{tournament.organiserName} </Text> : null}
            {tournament.notes}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** The blue card: my next match, my pair against theirs */
function NextMatchCard({ tournament, match, myId, onEnterScore }: { tournament: LiveTournament; match: LiveMatch; myId?: string; onEnterScore?: () => void }) {
  const { t } = useTranslation();
  const side = match.mySide ?? 1;
  const mine = entryById(tournament, side === 1 ? match.entry1Id : match.entry2Id);
  const theirs = entryById(tournament, side === 1 ? match.entry2Id : match.entry1Id);

  return (
    <View className="gap-3.5 rounded-3xl bg-accent p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text numberOfLines={1} className="shrink font-bold text-[12px] uppercase tracking-[0.8px] text-primary-tint-text">
          {t("tournaments.live.nextMatch", { match: matchTitle(match) })}
        </Text>
        <View className="rounded-[10px] bg-lime px-2.5 py-1">
          <Text className="font-bold text-[12px] text-lime-foreground">
            {match.submitted ? t("tournaments.live.matchState.sent") : t("tournaments.live.matchState.next")}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2 rounded-2xl bg-white/10 p-3">
        <Side entry={mine} tournament={tournament} myId={myId} />
        <Text className="font-black text-[12px] text-primary-tint-text">{t("tournaments.live.vs")}</Text>
        <Side entry={theirs} tournament={tournament} myId={myId} />
      </View>

      {match.submitted ? (
        <Text className="font-semibold text-[13px] text-primary-tint-text">
          {t("tournaments.live.sentScore", { score: scoreText(match.submitted, side) })}
        </Text>
      ) : null}

      {onEnterScore ? (
        <Button variant="secondary" onPress={onEnterScore} className="bg-surface">
          <Button.Label className="text-accent">
            {match.submitted ? t("tournaments.live.changeScore") : t("tournaments.live.enterScore")}
          </Button.Label>
        </Button>
      ) : null}
    </View>
  );
}

function Side({ entry, tournament, myId }: { entry: LiveEntry | undefined; tournament: LiveTournament; myId?: string }) {
  return (
    <View className="flex-1 items-center gap-1.5">
      <View className="flex-row">
        {playersOf(entry).map((player, index) => (
          <View key={player.id} style={index > 0 ? { marginStart: -FACE_OVERLAP } : undefined}>
            <PlayerAvatar player={player} size={FACE_SIZE} ringClassName="border-accent" />
          </View>
        ))}
      </View>
      <Text numberOfLines={2} className="text-center font-bold text-[13px] text-white">
        {entryName(entry, tournament.myEntryId, myId)}
      </Text>
    </View>
  );
}

/** Knockout rounds, the one being played first, then the ones still to come and those done */
function Bracket({ tournament, myId, enterScore }: SectionProps) {
  const { t } = useTranslation();
  const rounds = knockoutRounds(tournament);

  if (rounds.length === 0) {
    return (
      <View className="gap-1 rounded-[20px] border border-line bg-surface p-4">
        <Text className="font-black text-[15px] text-foreground">{t("tournaments.live.noBracketTitle")}</Text>
        <Text className="font-normal text-[14px] text-muted">{t("tournaments.live.noBracketText")}</Text>
      </View>
    );
  }

  const isDone = (matches: LiveMatch[]) => matches.every((match) => match.winnerEntryId);
  const current = rounds.find((round) => !isDone(round.matches));
  const ordered = [
    ...(current ? [current] : []),
    ...rounds.filter((round) => round.round > (current?.round ?? Infinity)),
    ...rounds.filter((round) => isDone(round.matches)).reverse(),
  ];

  return (
    <View className="gap-[18px]">
      {ordered.map((round) => (
        <View key={round.round} className="gap-2.5">
          <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
            {t(`tournaments.live.roundTitle.${round === current ? "now" : isDone(round.matches) ? "done" : "later"}`, {
              stage: t(`tournaments.live.stageLong.${round.stage}`),
            })}
          </Text>
          {round.matches.map((match) => (
            <BracketMatch key={match.id} tournament={tournament} match={match} myId={myId} onEnterScore={enterScore(match)} />
          ))}
        </View>
      ))}
    </View>
  );
}

function BracketMatch({ tournament, match, myId, onEnterScore }: { tournament: LiveTournament; match: LiveMatch; myId?: string; onEnterScore?: () => void }) {
  const { t } = useTranslation();
  const shown = match.score ?? match.submitted;
  const state = match.score ? "confirmed" : match.submitted ? "waiting" : match.entry1Id && match.entry2Id ? "next" : "later";

  return (
    <View className={cn("gap-2.5 rounded-[20px] border bg-surface p-3.5", match.mySide ? "border-accent" : "border-line")}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="font-bold text-[12px] text-ink-2">{match.label ?? matchTitle(match)}</Text>
        <Text className="font-bold text-[11px] uppercase text-muted">{t(`tournaments.live.matchState.${state}`)}</Text>
      </View>
      {([1, 2] as const).map((slot) => {
        const entry = entryById(tournament, slot === 1 ? match.entry1Id : match.entry2Id);
        const won = !!entry && match.winnerEntryId === entry.id;
        const lost = !!match.winnerEntryId && !won;
        return (
          <View key={slot} className="flex-row items-center gap-2.5">
            <View className="flex-row">
              {playersOf(entry).map((player, index) => (
                <PlayerAvatar key={player.id} player={player} size={28} ringClassName="border-surface" className={index > 0 ? "-ms-2" : undefined} />
              ))}
            </View>
            <Text numberOfLines={1} className={cn("flex-1 text-[14px]", entry ? (lost ? "font-normal text-muted" : "font-bold text-foreground") : "font-normal text-muted")}>
              {entry ? entryName(entry, tournament.myEntryId, myId) : waitingFor(tournament, match, slot)}
            </Text>
            {shown ? (
              <Text className={cn("text-[14px]", won ? "font-black text-foreground" : "font-semibold text-muted")} style={{ fontVariant: ["tabular-nums"] }}>
                {scoreText(shown, slot)}
              </Text>
            ) : null}
          </View>
        );
      })}
      {onEnterScore ? (
        <Button size="sm" variant="secondary" onPress={onEnterScore}>
          {match.submitted ? t("tournaments.live.changeScore") : t("tournaments.live.enterScore")}
        </Button>
      ) : null}
    </View>
  );
}

function Teams({ tournament, myId }: { tournament: LiveTournament; myId?: string }) {
  const { t } = useTranslation();
  const entries = [...tournament.entries].sort((a, b) => (a.groupLabel ?? "").localeCompare(b.groupLabel ?? "") || a.position - b.position);

  return (
    <View className="rounded-[20px] border border-line bg-surface px-4 py-1.5">
      {entries.map((entry, index) => (
        <View key={entry.id} className={cn("flex-row items-center gap-3 py-2.5", index > 0 && "border-t border-fill")}>
          <View className="flex-row">
            {playersOf(entry).map((player, faceIndex) => (
              <PlayerAvatar key={player.id} player={player} size={36} ringClassName="border-surface" className={faceIndex > 0 ? "-ms-3" : undefined} />
            ))}
          </View>
          <Text numberOfLines={1} className={cn("flex-1 text-[15px] text-foreground", entry.id === tournament.myEntryId ? "font-black" : "font-bold")}>
            {entryName(entry, tournament.myEntryId, myId)}
          </Text>
          {entry.groupLabel ? (
            <Text className="font-bold text-[12px] text-muted">{t("tournaments.live.group", { group: entry.groupLabel })}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
