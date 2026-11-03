import { router } from "expo-router";
import { Button, PressableFeedback, useToast } from "heroui-native";
import { CalendarDays, Check, Clock, MapPin, MessageSquare, Trophy, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionSheetIOS, Alert, Linking, Platform, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { MatchScoreCard } from "@/components/match-score-card";
import { Page } from "@/components/page";
import { PlayerSheet } from "@/components/player-sheet";
import { SaveScoreSheet } from "@/components/save-score-sheet";
import { SettingsRow, SettingsSection } from "@/components/settings-section";
import { TeamPicker } from "@/components/team-picker";
import { useClubs } from "@/hooks/useClubs";
import { useMatchChatUnreadCount } from "@/hooks/useMatchChat";
import { useCancelMatch, useConfirmScore, useLeaveMatch } from "@/hooks/useMatches";
import { useMyAccount } from "@/hooks/useMyProfile";
import { InfoNote } from "@/components/info-note";
import { showDirections } from "@/lib/directions";
import { addToCalendar, googleCalendarUrl, outlookCalendarUrl, type CalendarEventDetails } from "@/lib/add-to-calendar";
import { formatMatchDay, formatStartsIn } from "@/lib/format-date";
import { teamOf } from "@/lib/padel-score";
import { isRatingOpen, playersToRate } from "@/lib/player-rating";
import type { MatchDetails } from "@/types/match";
import type { Player } from "@/types/player";
import { errorMessage } from "@/lib/error-message";
import type { LucideIcon } from "lucide-react-native";

// The countdown shows minutes at its finest, so refresh it once a minute
const COUNTDOWN_REFRESH_MS = 60_000;
// How long after the match the host can add its score (same as the database)
const SCORE_SAVE_WINDOW_MS = 7 * 86_400_000;

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

type MyMatchProps = {
  match: MatchDetails;
  /** Hosts get the host tools and can cancel; players can leave */
  role: "host" | "player";
};

/**
 * Match detail for a match you're in (design: Your match · hosting / joined):
 * countdown, line-up, and host tools or a Leave button. Once it's over, the score takes
 * their place: the host adds it and one player from the other team confirms it.
 */
export function MyMatch({ match, role }: MyMatchProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const cancelMatch = useCancelMatch();
  const leaveMatch = useLeaveMatch();
  const confirmScore = useConfirmScore();
  const { data: account } = useMyAccount();
  const { data: clubs = [] } = useClubs();
  const { data: unreadMessages = 0 } = useMatchChatUnreadCount(match.id);
  const isHost = role === "host";
  const [now, setNow] = useState(() => new Date());
  const [scoreSheet, setScoreSheet] = useState<"add" | "correct" | "edit">();
  const [viewedPlayer, setViewedPlayer] = useState<Player>();
  const [isViewingPlayer, setIsViewingPlayer] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), COUNTDOWN_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const endsAt = new Date(match.startsAt.getTime() + match.durationMinutes * 60_000);
  const start = formatTime(match.startsAt);
  const end = formatTime(endsAt);
  const isOver = now >= endsAt;
  // One entry per seat, open ones undefined
  const seats = Array.from({ length: match.capacity }, (_, index) => (match.seats ?? match.players)[index]);
  const myId = account?.id ?? "";
  const score = match.score;
  const myTeam = teamOf(match, myId);
  const isPending = score?.status === "pending";
  // The other team confirms or corrects; the one who sent it can still edit it
  const canConfirm = isPending && myTeam !== undefined && myTeam !== score.submittedTeam;
  const canEdit = isPending && score.submittedBy === myId;
  const isTooLateToAdd = now.getTime() >= endsAt.getTime() + SCORE_SAVE_WINDOW_MS;
  const canAdd = isOver && isHost && !score && match.isFull !== false && !isTooLateToAdd;
  const canRate = account !== undefined && isRatingOpen(match, myId, now) && playersToRate(match, myId).length > 0;
  const place = match.isCourtBooked
    ? [match.clubName, match.courtName].filter(Boolean).join(" · ")
    : t("myMatch.courtNotBookedYet");
  const details = [
    place,
    t(match.kind === "competitive" ? "match.kind.competitive" : "match.kind.friendly"),
    match.levelMin !== undefined && match.levelMax !== undefined
      ? `${match.levelMin.toFixed(1)} – ${match.levelMax.toFixed(1)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // These need chat support, or the player-management API
  function comingSoon(label: string) {
    toast.show({ label, description: t("myMatch.comingSoon") });
  }

  const calendarEvent: CalendarEventDetails = {
    title: `${t("myMatch.calendarEventTitle")}${match.clubName ? ` · ${match.clubName}` : ""}`,
    startsAt: match.startsAt,
    endsAt,
    location: match.isCourtBooked ? place : undefined,
    notes: details,
  };

  async function addToPhoneCalendar() {
    try {
      const result = await addToCalendar(calendarEvent);
      if (!result.granted) {
        toast.show({ variant: "danger", label: t("myMatch.calendar"), description: t("myMatch.calendarDenied") });
      } else if (result.saved) {
        toast.show({
          variant: "success",
          label: t("myMatch.calendarAdded"),
          description: t("myMatch.calendarHint"),
        });
      }
    } catch (error) {
      toast.show({
        variant: "danger",
        label: t("myMatch.calendarFailed"),
        description: errorMessage(error),
      });
    }
  }

  // The event is a one-time copy, so remind the player to fix it if the match changes
  function openCalendarLink(url: string) {
    Linking.openURL(url).then(
      () => toast.show({ label: t("myMatch.calendarHint") }),
      (error: Error) =>
        toast.show({ variant: "danger", label: t("myMatch.calendarFailed"), description: errorMessage(error) }),
    );
  }

  function chooseCalendar() {
    const options = [
      { label: t("myMatch.calendarPhone"), run: addToPhoneCalendar },
      { label: t("myMatch.calendarGoogle"), run: () => openCalendarLink(googleCalendarUrl(calendarEvent)) },
      { label: t("myMatch.calendarOutlook"), run: () => openCalendarLink(outlookCalendarUrl(calendarEvent)) },
    ];
    if (Platform.OS === "ios") {
      // A native action sheet fits four rows; Alert on Android takes three buttons at most
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: t("myMatch.calendarChoose"),
          options: [...options.map((option) => option.label), t("myMatch.calendarCancel")],
          cancelButtonIndex: options.length,
        },
        (index) => options[index]?.run(),
      );
    } else {
      Alert.alert(
        t("myMatch.calendarChoose"),
        undefined,
        options.map((option) => ({ text: option.label, onPress: option.run })),
        { cancelable: true },
      );
    }
  }

  // The court isn't booked yet, so there is no club to go to
  function openDirections() {
    const club = clubs.find((item) => item.id === match.clubId);
    if (club) showDirections(club);
    else toast.show({ label: t("myMatch.directions"), description: t("myMatch.courtNotBookedYet") });
  }

  function confirmLeave() {
    Alert.alert(t("myMatch.leaveTitle"), t("myMatch.leaveText"), [
      { text: t("myMatch.stayIn"), style: "cancel" },
      {
        text: t("myMatch.leaveMatch"),
        style: "destructive",
        onPress: () =>
          leaveMatch.mutate(match.id, {
            onSuccess: () => {
              toast.show({ label: t("myMatch.left") });
              router.back();
            },
            onError: (error) =>
              toast.show({
                variant: "danger",
                label: t("myMatch.leaveFailed"),
                description: errorMessage(error),
              }),
          }),
      },
    ]);
  }

  function ratePlayers() {
    router.push({ pathname: "/match/[id]/rate", params: { id: match.id } });
  }

  // Rating comes right after the score, unless you already rated this match
  function rateAfterScore() {
    if (!match.ratedBy?.includes(myId) && playersToRate(match, myId).length > 0) ratePlayers();
  }

  function confirm() {
    confirmScore.mutate(match.id, {
      onSuccess: () => {
        toast.show({ variant: "success", label: t("myMatch.scoreConfirmed") });
        rateAfterScore();
      },
      onError: (error) =>
        toast.show({ variant: "danger", label: t("myMatch.confirmFailed"), description: errorMessage(error) }),
    });
  }

  function confirmCancel() {
    Alert.alert(t("myMatch.cancelTitle"), t("myMatch.cancelText"), [
      { text: t("myMatch.keepMatch"), style: "cancel" },
      {
        text: t("myMatch.cancelMatch"),
        style: "destructive",
        onPress: () =>
          cancelMatch.mutate(match.id, {
            onSuccess: () => {
              toast.show({ label: t("myMatch.cancelled") });
              router.back();
            },
            onError: (error) =>
              toast.show({
                variant: "danger",
                label: t("myMatch.cancelFailed"),
                description: errorMessage(error),
              }),
          }),
      },
    ]);
  }

  return (
    <Page>
      <Page.Header
        back
        leading={
          <Text
            accessibilityRole="header"
            className="font-black text-[22px] tracking-[-0.3px] text-foreground"
          >
            {t("myMatch.title")}
          </Text>
        }
      >
        <Text
          className={
            isHost
              ? "self-center overflow-hidden rounded-xl bg-accent px-3 py-1.5 font-bold text-[12px] text-accent-foreground"
              : "self-center overflow-hidden rounded-xl bg-success-soft px-3 py-1.5 font-bold text-[12px] text-success"
          }
        >
          {isHost ? t("myMatch.hosting") : t("myMatch.joined")}
        </Text>
      </Page.Header>

      <Page.Body className="gap-4">
        <View className="gap-3 rounded-[24px] bg-accent p-[18px]">
          <View className="flex-row items-center justify-between">
            <Text className="font-bold text-[12px] uppercase tracking-[0.8px] text-primary-tint-text">
              {isOver ? t("myMatch.played") : t("myMatch.startsIn")}
            </Text>
            {isHost && !isOver ? (
              <View className="flex-row items-center gap-1 rounded-[10px] bg-lime px-2.5 py-1">
                <Icon as={match.isCourtBooked ? Check : Clock} size={12} color="lime-foreground" />
                <Text className="font-bold text-[12px] text-lime-foreground">
                  {match.isCourtBooked ? t("matchDetail.courtBooked") : t("matchDetail.notBookedYet")}
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="font-black text-[32px] leading-[32px] tracking-[-0.8px] text-accent-foreground">
            {isOver ? t("myMatch.finished") : formatStartsIn(match.startsAt, now)}
          </Text>
          <View className="gap-0.5">
            <Text className="font-bold text-[16px] text-accent-foreground">
              {formatMatchDay(match.startsAt)} · {start} – {end}
            </Text>
            <Text className="font-normal text-[14px] text-primary-tint-text">{details}</Text>
          </View>
        </View>

        {isOver ? (
          <ScoreSection
            match={match}
            myId={myId}
            hostName={match.host?.firstName ?? t("matchDetail.theHost")}
            canAdd={canAdd}
            isTooLateToAdd={isTooLateToAdd}
          />
        ) : null}

        {!isOver && !isHost && !match.isCourtBooked ? (
          <InfoNote icon={Clock} tone="warning" title={t("myMatch.waitingCourtTitle")}>
            {t("myMatch.waitingCourtText", { host: match.host?.firstName ?? t("matchDetail.theHost") })}
          </InfoNote>
        ) : null}

        <View className="flex-row gap-2.5">
          {!isOver ? (
            <>
              <ActionTile icon={MapPin} label={t("myMatch.directions")} onPress={openDirections} />
              <ActionTile icon={CalendarDays} label={t("myMatch.calendar")} onPress={chooseCalendar} />
            </>
          ) : null}
          {/* The chat stays open after the match, e.g. to sort out the score or play again */}
          <ActionTile
            icon={MessageSquare}
            label={t("myMatch.groupChat")}
            showDot={unreadMessages > 0}
            onPress={() => router.push({ pathname: "/match/[id]/chat", params: { id: match.id } })}
          />
        </View>

        {/* Once there's a score, its card shows the teams (design: Past match recap) */}
        {match.score ? null : (
          <View className="gap-3 rounded-[20px] border border-line bg-surface p-3.5">
            <View className="flex-row items-baseline justify-between">
              <Text accessibilityRole="header" className="font-black text-[15px] text-foreground">
                {t("myMatch.lineUp", { count: match.players.length, capacity: match.capacity })}
              </Text>
              {isHost && !isOver ? (
                <PressableFeedback
                  onPress={() => comingSoon(t("myMatch.swappingTeams"))}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text className="font-bold text-[13px] text-accent">{t("myMatch.swapTeams")}</Text>
                </PressableFeedback>
              ) : null}
            </View>
            <TeamPicker
              seats={seats}
              onPlayerPress={(player) => {
                setViewedPlayer(player);
                setIsViewingPlayer(true);
              }}
              myId={account?.id}
            />
          </View>
        )}

        {isHost && !isOver ? (
        <SettingsSection title={t("myMatch.hostTools")}>
          <SettingsRow
            label={t("myMatch.editTimeLevelType")}
            onPress={() => comingSoon(t("myMatch.editingMatch"))}
          />
          <SettingsRow
            label={
              match.courtName
                ? t("myMatch.bookingCourt", { court: match.courtName })
                : t("myMatch.booking")
            }
            value={match.isCourtBooked ? t("myMatch.booked") : t("myMatch.addCourt")}
            onPress={() => comingSoon(t("myMatch.booking"))}
          />
          <SettingsRow
            label={t("myMatch.managePlayers")}
            value={t("myMatch.managePlayersValue")}
            onPress={() => comingSoon(t("myMatch.managingPlayers"))}
          />
        </SettingsSection>
        ) : null}
      </Page.Body>

      {!isOver ? (
        <Page.Footer>
          <Button
            size="lg"
            variant="outline"
            onPress={isHost ? confirmCancel : confirmLeave}
            isDisabled={cancelMatch.isPending || leaveMatch.isPending}
            className="border-attention-outline bg-surface"
          >
            <Button.Label className="text-attention-action">
              {isHost ? t("myMatch.cancelMatch") : t("myMatch.leaveMatch")}
            </Button.Label>
          </Button>
        </Page.Footer>
      ) : canAdd ? (
        <Page.Footer>
          <Button size="lg" onPress={() => setScoreSheet("add")}>
            {t("myMatch.addScore")}
          </Button>
        </Page.Footer>
      ) : canConfirm ? (
        <Page.Footer className="gap-1">
          <Button size="lg" onPress={confirm} isDisabled={confirmScore.isPending}>
            {t("myMatch.confirmScore")}
          </Button>
          <Button variant="ghost" onPress={() => setScoreSheet("correct")}>
            <Button.Label className="text-muted">{t("myMatch.notRight")}</Button.Label>
          </Button>
        </Page.Footer>
      ) : canRate ? (
        <Page.Footer className="gap-1">
          <Button size="lg" onPress={ratePlayers}>
            {t("myMatch.ratePlayers")}
          </Button>
          {canEdit ? (
            <Button variant="ghost" onPress={() => setScoreSheet("edit")}>
              <Button.Label className="text-muted">{t("myMatch.editScore")}</Button.Label>
            </Button>
          ) : null}
        </Page.Footer>
      ) : canEdit ? (
        <Page.Footer>
          <Button size="lg" variant="secondary" onPress={() => setScoreSheet("edit")}>
            {t("myMatch.editScore")}
          </Button>
        </Page.Footer>
      ) : null}

      {account ? (
        <SaveScoreSheet
          match={match}
          myId={myId}
          mode={scoreSheet ?? "add"}
          isOpen={scoreSheet !== undefined}
          onOpenChange={(open) => !open && setScoreSheet(undefined)}
          onSaved={scoreSheet === "edit" ? undefined : rateAfterScore}
        />
      ) : null}
      <PlayerSheet
        player={viewedPlayer}
        isOpen={isViewingPlayer}
        onOpenChange={setIsViewingPlayer}
      />
    </Page>
  );
}

type ScoreSectionProps = {
  match: MatchDetails;
  myId: string;
  hostName: string;
  canAdd: boolean;
  isTooLateToAdd: boolean;
};

/** The score once it's sent, or a note on what happens next when there's none. */
function ScoreSection({ match, myId, hostName, canAdd, isTooLateToAdd }: ScoreSectionProps) {
  const { t } = useTranslation();
  if (match.score) return <MatchScoreCard match={{ ...match, score: match.score }} myId={myId} />;
  if (match.isFull === false) {
    return (
      <InfoNote icon={Users} tone="warning" title={t("myMatch.noScoreTitle")}>
        {t("myMatch.noScoreText")}
      </InfoNote>
    );
  }
  if (canAdd) {
    return (
      <InfoNote icon={Trophy} title={t("myMatch.howDidItGo")}>
        {t("myMatch.howDidItGoText")}
      </InfoNote>
    );
  }
  if (isTooLateToAdd) {
    return (
      <InfoNote icon={Clock} tone="warning" title={t("myMatch.noScoreAddedTitle")}>
        {t("myMatch.noScoreAddedText")}
      </InfoNote>
    );
  }
  return (
    <InfoNote icon={Clock} title={t("myMatch.waitingScoreTitle", { host: hostName })}>
      {t("myMatch.waitingScoreText", { host: hostName })}
    </InfoNote>
  );
}

function ActionTile({
  icon,
  label,
  showDot,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  /** Orange unread dot, e.g. new chat messages */
  showDot?: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={showDot ? t("common.unread", { label }) : label}
      className="h-16 flex-1 items-center justify-center gap-1 rounded-2xl border border-line bg-surface"
    >
      <View>
        <Icon as={icon} size={20} color="accent" />
        {showDot ? <View className="absolute -end-1 -top-0.5 size-2 rounded-full bg-dot" /> : null}
      </View>
      <Text className="font-bold text-[12px] text-foreground">{label}</Text>
    </PressableFeedback>
  );
}
