import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { Button, cn, Spinner, useToast } from "heroui-native";
import {
  CalendarDays,
  Check,
  Clock,
  Info,
  LayoutGrid,
  MapPin,
  Share as ShareIcon,
  Trophy,
  TriangleAlert,
  Wallet,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COURT_HERO_HEIGHT, CourtHero } from "@/components/court-hero";
import { Icon } from "@/components/icon";
import { IconButton } from "@/components/icon-button";
import { InfoNote } from "@/components/info-note";
import { LoadError } from "@/components/load-error";
import { Page } from "@/components/page";
import { PlayerAvatar } from "@/components/player-avatar";
import { TournamentDetailRow } from "@/components/tournament-detail-row";
import { TournamentJoinSheet } from "@/components/tournament-join-sheet";
import { TournamentTeamRow } from "@/components/tournament-team-row";
import { tournamentsKey, useLeaveTournament, useRespondToTournamentInvite, useTournament } from "@/hooks/useTournaments";
import { errorMessage } from "@/lib/error-message";
import { formatMatchDateTime, formatMatchDay, formatTime } from "@/lib/format-date";
import { queryClient } from "@/lib/query-client";
import { entryUnit, formatFee, hasFewSpots, isIndividual } from "@/lib/tournament";
import type { Player } from "@/types/player";
import type { TournamentDetail as Tournament } from "@/types/tournament";

// How far the white sheet slides up over the court (design "Tournament detail")
const SHEET_OVERLAP = 36;
// Pairs shown before "See all N teams"
const TEAMS_SHOWN = 5;
// Faces in the "friends are playing" banner
const FRIEND_FACES = 3;
const FRIEND_FACE_SIZE = 30;
const FRIEND_FACE_OVERLAP = 9;
// The app's own link; there is no website to send people to yet
const TOURNAMENT_LINK = "padelna:///tournament/";

function refresh() {
  return queryClient.refetchQueries({ queryKey: tournamentsKey });
}

export default function TournamentDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useTournament(id);
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

  if (query.error && !tournament) {
    return (
      <Page>
        <Page.Header back />
        <Page.Body>
          <LoadError
            message={t("tournaments.detail.loadFailed", { message: errorMessage(query.error) })}
            onRetry={() => query.refetch()}
            isRetrying={query.isRefetching}
          />
        </Page.Body>
      </Page>
    );
  }

  if (!tournament) {
    return (
      <Page>
        <Page.Header back />
        <Page.Body>
          <Page.Title description={t("tournaments.detail.notFoundText")}>{t("tournaments.detail.notFound")}</Page.Title>
        </Page.Body>
      </Page>
    );
  }

  return <TournamentScreen tournament={tournament} />;
}

function TournamentScreen({ tournament }: { tournament: Tournament }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const respond = useRespondToTournamentInvite();
  const leave = useLeaveTournament();
  const [isJoining, setIsJoining] = useState(false);
  const [showAllTeams, setShowAllTeams] = useState(false);
  const insets = useSafeAreaInsets();
  // Once the sheet scrolls up to the status bar, the bar needs a background of its own
  const [isPastHero, setIsPastHero] = useState(false);
  // Dark text reads on both the pale court and the white bar; another screen may have left it light
  useFocusEffect(useCallback(() => setStatusBarStyle("dark"), []));

  const {
    capacity,
    entriesCount,
    spotsLeft,
    waitlistCount,
    registrationOpen,
    myEntry,
    myFit,
    myLevel,
    levelMin,
    levelMax,
    entryFee,
    startsAt,
    endsAt,
    teams,
  } = tournament;

  const unit = t(`tournaments.unit.${entryUnit(tournament)}`);
  const isFull = spotsLeft === 0;
  const hasRange = levelMin !== undefined && levelMax !== undefined;
  const rangeText = hasRange ? `${levelMin.toFixed(1)} – ${levelMax.toFixed(1)}` : "";
  const isBeforeStart = tournament.status === "setup";
  const isClosed = isBeforeStart && !registrationOpen && tournament.format === "groups" && capacity !== undefined;
  const canJoin = registrationOpen && !myEntry && myFit === "ok";
  // On the partner list you can still pick a partner and swap to a pair
  const canPickPartner = canJoin || (registrationOpen && myEntry?.status === "looking");

  // A friend still waiting on a partner isn't playing yet
  const friends = teams
    .filter((team) => team.status === "confirmed")
    .flatMap((team) => [team.player1, team.player2])
    .filter((player) => player !== undefined && player.isFriend) as Player[];
  // Your friends' pairs come first (design "Who joined")
  const sortedTeams = [...teams].sort(
    (a, b) =>
      Number(!!(b.player1?.isFriend || b.player2?.isFriend)) - Number(!!(a.player1?.isFriend || a.player2?.isFriend)),
  );
  const shownTeams = showAllTeams ? sortedTeams : sortedTeams.slice(0, TEAMS_SHOWN);

  const { groupCount } = tournament;
  const perGroup = groupSize(groupCount, capacity);
  const formatValue =
    tournament.format === "americano"
      ? t("tournaments.format.americano")
      : groupCount && perGroup
        ? t("tournaments.detail.groupsOf", { groups: groupCount, size: perGroup })
        : groupCount
          ? t("tournaments.detail.groupsOnly", { groups: groupCount })
          : t("tournaments.format.groups");
  const dateValue = startsAt
    ? endsAt && endsAt.toDateString() === startsAt.toDateString()
      ? `${formatMatchDateTime(startsAt)} – ${formatTime(endsAt)}`
      : formatMatchDateTime(startsAt)
    : t("tournaments.detail.dateSoon");

  function share() {
    const about = [tournament.name, startsAt ? formatMatchDateTime(startsAt) : undefined, tournament.clubName]
      .filter(Boolean)
      .join(" · ");
    Share.share({ message: `${about}\n${TOURNAMENT_LINK}${tournament.id}` });
  }

  function answerInvite(accept: boolean) {
    if (!myEntry) return;
    respond.mutate(
      { entryId: myEntry.id, accept },
      {
        onSuccess: () =>
          toast.show({
            variant: "success",
            label: accept ? t("tournaments.mine.accepted") : t("tournaments.mine.declined"),
          }),
        onError: (error) =>
          toast.show({ variant: "danger", label: t("tournaments.mine.answerFailed"), description: errorMessage(error) }),
      },
    );
  }

  function confirmLeave() {
    if (!myEntry) return;
    const isInvite = myEntry.status === "invited" || myEntry.status === "waitlist_invited";
    const isList = myEntry.status === "looking";
    const key = isList ? "leaveList" : isInvite ? "cancelInvite" : "leave";
    // A waitlist invite holds no spot, so nothing opens up when it ends
    const text = myEntry.status === "waitlist_invited" ? t("tournaments.mine.cancelWaitlistInviteText") : t(`tournaments.mine.${key}Text`);
    Alert.alert(t(`tournaments.mine.${key}Title`), text, [
      { text: t("tournaments.mine.keep"), style: "cancel" },
      {
        text: t(`tournaments.mine.${key}`),
        style: "destructive",
        onPress: () =>
          leave.mutate(tournament.id, {
            onError: (error) =>
              toast.show({ variant: "danger", label: t("tournaments.mine.leaveFailed"), description: errorMessage(error) }),
          }),
      },
    ]);
  }

  const isInvitedPartner =
    myEntry?.role === "partner" && (myEntry.status === "invited" || myEntry.status === "waitlist_invited");
  const showFooter = isBeforeStart && (!!myEntry || canJoin);

  return (
    <Page surface underStatusBar>
      <Page.Body
        className="gap-0 px-0"
        onRefresh={refresh}
        onScrollY={(y) => setIsPastHero(y > COURT_HERO_HEIGHT - SHEET_OVERLAP - insets.top)}
      >
        <CourtHero
          tint="blue"
          showBall
          rightAction={
            <IconButton icon={ShareIcon} label={t("tournaments.detail.share")} onPress={share} className="border-0 bg-white/90" />
          }
        />

        <View className="gap-[22px] rounded-t-[28px] bg-surface px-5 pt-[22px]" style={{ marginTop: -SHEET_OVERLAP }}>
          <View className="gap-2">
            <View className="flex-row flex-wrap gap-1.5">
              <View className="rounded-[10px] bg-foreground px-2.5 py-1">
                <Text className="font-bold text-[12px] text-lime">{t("tournaments.detail.tournament")}</Text>
              </View>
              {hasRange ? (
                <View className="rounded-[10px] bg-lime-soft px-2.5 py-1">
                  <Text className="font-bold text-[12px] text-lime-foreground">{t("tournaments.detail.levelRange", { range: rangeText })}</Text>
                </View>
              ) : null}
              <View className="rounded-[10px] bg-out-of-range px-2.5 py-1">
                <Text className="font-bold text-[12px] text-ink-2">
                  {t(isIndividual(tournament) ? "tournaments.entry.individual" : "tournaments.entry.pairs")} · {t(`home.tournament.category.${tournament.category}`)}
                </Text>
              </View>
            </View>
            <Text accessibilityRole="header" className="font-black text-[26px] tracking-[-0.4px] text-foreground">
              {tournament.name}
            </Text>
            {tournament.clubName ? (
              <View className="flex-row items-center gap-1.5">
                <Icon as={MapPin} size={16} color="muted" />
                <Pressable
                  accessibilityRole={tournament.clubId ? "link" : undefined}
                  disabled={!tournament.clubId}
                  hitSlop={8}
                  onPress={() => tournament.clubId && router.push({ pathname: "/club/[id]", params: { id: tournament.clubId } })}
                >
                  <Text className="font-semibold text-[15px] text-foreground">{tournament.clubName}</Text>
                </Pressable>
                {tournament.clubCity ? <Text className="font-normal text-[15px] text-muted">· {tournament.clubCity}</Text> : null}
              </View>
            ) : null}
          </View>

          {/* Capacity: "12 of 16 teams", or just the count before the admin sets a capacity */}
          <View className="gap-2.5 rounded-[20px] bg-background px-4 py-3.5">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="shrink font-black text-[15px] text-foreground">
                {capacity !== undefined
                  ? t("tournaments.detail.countOf", { count: entriesCount, capacity, unit })
                  : `${entriesCount} ${unit}`}
              </Text>
              {isClosed ? (
                <View className="rounded-[10px] bg-out-of-range px-2.5 py-1">
                  <Text className="font-bold text-[12px] text-ink-2">{t("tournaments.closed")}</Text>
                </View>
              ) : capacity !== undefined && isBeforeStart ? (
                isFull ? (
                  <View className="rounded-[10px] bg-attention-soft px-2.5 py-1">
                    <Text className="font-bold text-[12px] text-attention">
                      {waitlistCount > 0 ? t("tournaments.detail.fullWaitlist", { count: waitlistCount }) : t("tournaments.full")}
                    </Text>
                  </View>
                ) : (
                  <View className={cn("rounded-[10px] px-2.5 py-1", hasFewSpots(spotsLeft ?? 0) ? "bg-warning-soft" : "bg-out-of-range")}>
                    <Text className={cn("font-bold text-[12px]", hasFewSpots(spotsLeft ?? 0) ? "text-warning" : "text-ink-2")}>
                      {t("tournaments.spotsLeft", { count: spotsLeft ?? 0 })}
                    </Text>
                  </View>
                )
              ) : null}
            </View>
            {capacity !== undefined ? (
              <View className="h-2 overflow-hidden rounded bg-track">
                <View
                  className={cn("h-full rounded", isFull ? "bg-muted-icon" : "bg-accent")}
                  style={{ width: `${Math.min((entriesCount / capacity) * 100, 100)}%` }}
                />
              </View>
            ) : null}
            {isClosed ? (
              <Text className="font-normal text-[13px] text-muted">{t("tournaments.detail.closed")}</Text>
            ) : canJoin && isFull ? (
              <Text className="font-normal text-[13px] text-muted">{t("tournaments.detail.fullNote")}</Text>
            ) : registrationOpen && tournament.registrationClosesAt ? (
              <Text className="font-normal text-[13px] text-muted">
                {t("tournaments.detail.closes")}{" "}
                <Text className="font-bold text-foreground">
                  {t("tournaments.detail.closesAt", {
                    day: formatMatchDay(tournament.registrationClosesAt),
                    time: formatTime(tournament.registrationClosesAt),
                  })}
                </Text>
              </Text>
            ) : null}
          </View>

          <MyEntryNote tournament={tournament} />

          {/* Whether you can join; once you're in, MyEntryNote says where you stand */}
          {!myEntry && tournament.format === "americano" ? (
            <InfoNote icon={Info} title={t("tournaments.detail.americanoSoon")}>
              {t("tournaments.detail.americanoSoonText")}
            </InfoNote>
          ) : !myEntry && isBeforeStart && capacity === undefined ? (
            <InfoNote icon={Info} title={t("tournaments.detail.notOpenYet")}>
              {t("tournaments.detail.notOpenYetText")}
            </InfoNote>
          ) : !myEntry && registrationOpen && myFit === "ok" && hasRange && myLevel !== undefined ? (
            <View className="flex-row items-center gap-2 rounded-[14px] bg-success-soft px-3 py-2.5">
              <Icon as={Check} size={18} color="success-soft-foreground" />
              <Text className="flex-1 font-semibold text-[14px] text-success-soft-foreground">
                {t("tournaments.detail.fits", { level: myLevel.toFixed(1) })}
              </Text>
            </View>
          ) : !myEntry && registrationOpen && (myFit === "below_range" || myFit === "above_range") ? (
            <InfoNote icon={TriangleAlert} tone="warning" title={t("tournaments.detail.outsideRange")}>
              {t(myFit === "below_range" ? "tournaments.detail.belowRange" : "tournaments.detail.aboveRange", {
                level: myLevel?.toFixed(1) ?? "",
                range: rangeText,
              })}
            </InfoNote>
          ) : !myEntry && registrationOpen && myFit === "wrong_category" ? (
            <InfoNote icon={TriangleAlert} tone="warning" title={t("tournaments.detail.wrongCategory")}>
              {t("tournaments.detail.wrongCategoryText", { category: t(`home.tournament.category.${tournament.category}`) })}
            </InfoNote>
          ) : null}

          <View className="gap-3">
            <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">{t("tournaments.detail.details")}</Text>
            <View className="gap-3.5">
              <TournamentDetailRow
                icon={CalendarDays}
                label={t("tournaments.detail.date")}
                value={dateValue}
                note={tournament.checkInNote}
              />
              <TournamentDetailRow
                icon={LayoutGrid}
                label={t("tournaments.detail.format")}
                value={formatValue}
                note={perGroup ? t("tournaments.detail.minMatches", { count: perGroup - 1 }) : undefined}
              />
              {entryFee !== undefined ? (
                <TournamentDetailRow
                  icon={Wallet}
                  label={t("tournaments.detail.fee")}
                  value={t("tournaments.detail.feePerTeam", { fee: formatFee(entryFee) })}
                  note={t("tournaments.detail.feeNote")}
                />
              ) : null}
              {tournament.prizes ? (
                <TournamentDetailRow
                  icon={Trophy}
                  label={t("tournaments.detail.prizes")}
                  value={tournament.prizes}
                  note={tournament.prizesNote}
                />
              ) : null}
            </View>
          </View>

          <View className="gap-3">
            <View className="flex-row items-baseline justify-between gap-3">
              <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">{t("tournaments.detail.whoJoined")}</Text>
              {tournament.avgLevel !== undefined ? (
                <Text className="font-normal text-[13px] text-muted">{t("tournaments.detail.avgLevel", { level: tournament.avgLevel.toFixed(1) })}</Text>
              ) : null}
            </View>

            {friends.length > 0 ? (
              <View className="flex-row items-center gap-2.5 rounded-2xl bg-primary-soft px-3 py-2.5">
                <View className="flex-row">
                  {friends.slice(0, FRIEND_FACES).map((friend, index) => (
                    <View key={friend.id} style={index > 0 ? { marginStart: -FRIEND_FACE_OVERLAP } : undefined}>
                      <PlayerAvatar player={friend} size={FRIEND_FACE_SIZE} ringClassName="border-primary-soft" />
                    </View>
                  ))}
                </View>
                <Text className="flex-1 font-semibold text-[13px] text-primary-dark">
                  <Text className="font-black">{t("tournaments.detail.friendsCount", { count: friends.length })}</Text>{" "}
                  {t("tournaments.detail.friendsPlaying", { count: friends.length })}
                </Text>
              </View>
            ) : null}

            {teams.length === 0 ? (
              <Text className="font-normal text-[14px] text-muted">{canJoin ? t("tournaments.detail.noTeams") : t("tournaments.detail.noEntries")}</Text>
            ) : (
              <View>
                {shownTeams.map((team) => (
                  <TournamentTeamRow key={team.id} team={team} isMine={team.id === myEntry?.id} />
                ))}
              </View>
            )}

            {!showAllTeams && teams.length > TEAMS_SHOWN ? (
              <Button variant="outline" onPress={() => setShowAllTeams(true)} className="h-11 rounded-[14px] border-line-input bg-surface">
                <Button.Label className="font-bold text-[14px] text-foreground">
                  {t("tournaments.detail.seeAll", { count: teams.length, unit })}
                </Button.Label>
              </Button>
            ) : null}
          </View>

          {tournament.organiserName || tournament.notes ? (
            <View className="gap-3 pb-2">
              <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">{t("tournaments.detail.organiser")}</Text>
              {tournament.organiserName ? (
                <View className="flex-row items-center gap-3">
                  <PlayerAvatar player={organiserAsPlayer(tournament.organiserName)} size={44} />
                  <View className="flex-1">
                    <Text className="font-bold text-[15px] text-foreground">{tournament.organiserName}</Text>
                    <Text className="font-normal text-[13px] text-muted">
                      {[tournament.clubName, t("tournaments.detail.runsDraw")].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                </View>
              ) : null}
              {tournament.notes ? (
                <Text className="font-normal text-[14px] leading-[21px] text-ink-2">{tournament.notes}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </Page.Body>

      {isPastHero ? (
        <View pointerEvents="none" className="absolute inset-x-0 top-0 bg-surface" style={{ height: insets.top }} />
      ) : null}

      {showFooter ? (
        <Page.Footer
          className={cn(
            "gap-2.5 border-t border-line-soft bg-surface",
            // Two long labels don't fit side by side on the partner list
            myEntry?.status === "looking" ? "flex-col" : "flex-row items-center",
          )}
        >
          {isInvitedPartner ? (
            <>
              <Button size="lg" variant="outline" className="flex-1 border-attention-outline bg-surface" isDisabled={respond.isPending} onPress={() => answerInvite(false)}>
                <Button.Label className="text-attention-action">{t("tournaments.mine.decline")}</Button.Label>
              </Button>
              <Button size="lg" className="flex-[1.4]" isDisabled={respond.isPending} onPress={() => answerInvite(true)}>
                {t("tournaments.mine.accept")}
              </Button>
            </>
          ) : canPickPartner ? (
            myEntry ? (
              <>
                <Button size="lg" onPress={() => setIsJoining(true)}>
                  {t("tournaments.mine.pickPartner")}
                </Button>
                <Button size="lg" variant="outline" className="border-attention-outline bg-surface" isDisabled={leave.isPending} onPress={confirmLeave}>
                  <Button.Label className="text-attention-action">{t("tournaments.mine.leaveList")}</Button.Label>
                </Button>
              </>
            ) : (
              <>
                {entryFee !== undefined ? (
                  <View className="min-w-[86px]">
                    <Text className="font-semibold text-[12px] text-muted">{t("tournaments.detail.perTeam")}</Text>
                    <Text className="font-black text-[17px] text-foreground">{t("tournaments.detail.feeValue", { fee: formatFee(entryFee) })}</Text>
                  </View>
                ) : null}
                <Button size="lg" className="flex-1" onPress={() => setIsJoining(true)}>
                  {isFull ? t("tournaments.detail.joinWaitlist") : t("tournaments.detail.joinWithPartner")}
                </Button>
              </>
            )
          ) : myEntry ? (
            <Button size="lg" variant="outline" className="flex-1 border-attention-outline bg-surface" isDisabled={leave.isPending} onPress={confirmLeave}>
              <Button.Label className="text-attention-action">
                {myEntry.status === "invited" || myEntry.status === "waitlist_invited"
                  ? t("tournaments.mine.cancelInvite")
                  : t("tournaments.mine.leave")}
              </Button.Label>
            </Button>
          ) : null}
        </Page.Footer>
      ) : null}

      <TournamentJoinSheet tournament={tournament} isOpen={isJoining} onClose={() => setIsJoining(false)} />
    </Page>
  );
}

/** Where you stand in this tournament. No artboard: the app's usual notes. */
function MyEntryNote({ tournament }: { tournament: Tournament }) {
  const { t } = useTranslation();
  const { myEntry, entryFee } = tournament;
  if (!myEntry) return null;

  const name = myEntry.partner?.firstName ?? t("notifications.someone");
  const expiry = myEntry.inviteExpiresAt ? formatMatchDateTime(myEntry.inviteExpiresAt) : "";
  const pay = entryFee !== undefined ? ` ${t("tournaments.join.payAtDesk", { fee: formatFee(entryFee) })}` : "";

  switch (myEntry.status) {
    case "confirmed":
      return (
        <InfoNote icon={Check} title={t("tournaments.mine.inTitle")}>
          {`${t("tournaments.mine.inText", { name })}${pay}`}
        </InfoNote>
      );
    case "invited":
      return myEntry.role === "captain" ? (
        <InfoNote icon={Clock} tone="warning" title={t("tournaments.mine.waitingTitle", { name })}>
          {t("tournaments.mine.waitingText", { name, when: expiry })}
        </InfoNote>
      ) : (
        <InfoNote icon={Info} title={t("tournaments.mine.invitedTitle", { name })}>
          {`${t("tournaments.mine.invitedText", { when: expiry })}${pay}`}
        </InfoNote>
      );
    case "waitlist_invited":
      return myEntry.role === "captain" ? (
        <InfoNote icon={Clock} tone="warning" title={t("tournaments.mine.waitingTitle", { name })}>
          {t("tournaments.mine.waitingWaitlistText", { name, when: expiry })}
        </InfoNote>
      ) : (
        <InfoNote icon={Info} title={t("tournaments.mine.invitedTitle", { name })}>
          {t("tournaments.mine.invitedWaitlistText", { when: expiry })}
        </InfoNote>
      );
    case "waitlist":
      return (
        <InfoNote icon={Clock} tone="warning" title={t("tournaments.mine.waitlistTitle")}>
          {t("tournaments.mine.waitlistText", { name })}
        </InfoNote>
      );
    case "looking":
      return (
        <InfoNote icon={Info} title={t("tournaments.mine.lookingTitle")}>
          {t("tournaments.mine.lookingText")}
        </InfoNote>
      );
  }
}

/** Pairs per group when they share out evenly; otherwise the screen doesn't promise a number */
function groupSize(groupCount?: number, capacity?: number) {
  if (!groupCount || !capacity || capacity % groupCount !== 0) return undefined;
  return capacity / groupCount;
}

/** The organiser is a name, not an account; this only draws the initials. */
function organiserAsPlayer(name: string): Player {
  const [firstName, ...rest] = name.split(" ");
  return { id: name, firstName, lastName: rest.join(" ") };
}
