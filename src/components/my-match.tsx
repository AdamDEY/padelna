import { router } from "expo-router";
import { Button, PressableFeedback, useToast } from "heroui-native";
import { CalendarDays, Check, Clock, MapPin, MessageSquare, Trophy, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { MatchLineUp } from "@/components/match-line-up";
import { MatchScoreCard } from "@/components/match-score-card";
import { Page } from "@/components/page";
import { PlayerSheet } from "@/components/player-sheet";
import { SaveScoreSheet } from "@/components/save-score-sheet";
import { SettingsRow, SettingsSection } from "@/components/settings-section";
import { useCancelMatch, useConfirmScore, useLeaveMatch } from "@/hooks/useMatches";
import { useMyAccount } from "@/hooks/useMyProfile";
import { InfoNote } from "@/components/info-note";
import { formatMatchDay, formatStartsIn } from "@/lib/format-date";
import { teamOf } from "@/lib/padel-score";
import type { MatchDetails } from "@/types/match";
import type { Player } from "@/types/player";
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
  const { toast } = useToast();
  const cancelMatch = useCancelMatch();
  const leaveMatch = useLeaveMatch();
  const confirmScore = useConfirmScore();
  const { data: account } = useMyAccount();
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
  const myId = account?.id ?? "";
  const score = match.score;
  const myTeam = teamOf(match, myId);
  const isPending = score?.status === "pending";
  // The other team confirms or corrects; the one who sent it can still edit it
  const canConfirm = isPending && myTeam !== undefined && myTeam !== score.submittedTeam;
  const canEdit = isPending && score.submittedBy === myId;
  const isTooLateToAdd = now.getTime() >= endsAt.getTime() + SCORE_SAVE_WINDOW_MS;
  const canAdd = isOver && isHost && !score && match.isFull !== false && !isTooLateToAdd;
  const place = match.isCourtBooked
    ? [match.clubName, match.courtName].filter(Boolean).join(" · ")
    : "Court not booked yet";
  const details = [
    place,
    match.kind === "competitive" ? "Competitive" : "Friendly",
    match.levelMin !== undefined && match.levelMax !== undefined
      ? `${match.levelMin.toFixed(1)} – ${match.levelMax.toFixed(1)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // These need chat, maps and calendar support, or the player-management API
  function comingSoon(label: string) {
    toast.show({ label, description: "This is coming soon." });
  }

  function confirmLeave() {
    Alert.alert("Leave this match?", "Your spot will open up for other players.", [
      { text: "Stay in", style: "cancel" },
      {
        text: "Leave match",
        style: "destructive",
        onPress: () =>
          leaveMatch.mutate(match.id, {
            onSuccess: () => {
              toast.show({ label: "You left the match" });
              router.back();
            },
            onError: (error) =>
              toast.show({
                variant: "danger",
                label: "Couldn’t leave the match",
                description: error.message,
              }),
          }),
      },
    ]);
  }

  function confirm() {
    confirmScore.mutate(match.id, {
      onSuccess: () => toast.show({ variant: "success", label: "Score confirmed" }),
      onError: (error) =>
        toast.show({ variant: "danger", label: "Couldn’t confirm the score", description: error.message }),
    });
  }

  function confirmCancel() {
    Alert.alert("Cancel this match?", "It will be removed for everyone in the line-up.", [
      { text: "Keep match", style: "cancel" },
      {
        text: "Cancel match",
        style: "destructive",
        onPress: () =>
          cancelMatch.mutate(match.id, {
            onSuccess: () => {
              toast.show({ label: "Match cancelled" });
              router.back();
            },
            onError: (error) =>
              toast.show({
                variant: "danger",
                label: "Couldn’t cancel the match",
                description: error.message,
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
            Your match
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
          {isHost ? "Hosting" : "Joined"}
        </Text>
      </Page.Header>

      <Page.Body className="gap-4">
        <View className="gap-3 rounded-[24px] bg-accent p-[18px]">
          <View className="flex-row items-center justify-between">
            <Text className="font-bold text-[12px] uppercase tracking-[0.8px] text-primary-tint-text">
              {isOver ? "Played" : "Starts in"}
            </Text>
            {isHost && !isOver ? (
              <View className="flex-row items-center gap-1 rounded-[10px] bg-lime px-2.5 py-1">
                <Icon as={match.isCourtBooked ? Check : Clock} size={12} color="lime-foreground" />
                <Text className="font-bold text-[12px] text-lime-foreground">
                  {match.isCourtBooked ? "Court booked" : "Not booked yet"}
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="font-black text-[32px] leading-[32px] tracking-[-0.8px] text-accent-foreground">
            {isOver ? "Match finished" : formatStartsIn(match.startsAt, now)}
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
            hostName={match.host?.firstName ?? "The host"}
            canAdd={canAdd}
            isTooLateToAdd={isTooLateToAdd}
          />
        ) : null}

        {!isOver && !isHost && !match.isCourtBooked ? (
          <InfoNote icon={Clock} tone="warning" title="Court not booked yet.">
            {`${match.host?.firstName ?? "The host"} will confirm once it’s reserved.`}
          </InfoNote>
        ) : null}

        {!isOver ? (
        <View className="flex-row gap-2.5">
          <ActionTile icon={MapPin} label="Directions" onPress={() => comingSoon("Directions")} />
          <ActionTile icon={CalendarDays} label="Calendar" onPress={() => comingSoon("Calendar")} />
          <ActionTile
            icon={MessageSquare}
            label="Group chat"
            onPress={() => comingSoon("Group chat")}
          />
        </View>
        ) : null}

        <View className="gap-3 rounded-[20px] border border-line bg-surface p-3.5">
          <View className="flex-row items-baseline justify-between">
            <Text accessibilityRole="header" className="font-black text-[15px] text-foreground">
              Line-up · {match.players.length}/{match.capacity}
            </Text>
            {isHost && !isOver ? (
              <PressableFeedback
                onPress={() => comingSoon("Swapping teams")}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text className="font-bold text-[13px] text-accent">Swap teams</Text>
              </PressableFeedback>
            ) : null}
          </View>
          <MatchLineUp
            players={match.seats ?? match.players}
            capacity={match.capacity}
            newPlayerIds={new Set()}
            openSeatLabel="Open"
            onPlayerPress={(player) => {
              setViewedPlayer(player);
              setIsViewingPlayer(true);
            }}
            myId={account?.id}
          />
        </View>

        {isHost && !isOver ? (
        <SettingsSection title="Host tools">
          <SettingsRow
            label="Edit time, level or type"
            onPress={() => comingSoon("Editing your match")}
          />
          <SettingsRow
            label={match.courtName ? `Booking · ${match.courtName}` : "Booking"}
            value={match.isCourtBooked ? "Booked" : "Add court"}
            onPress={() => comingSoon("Booking")}
          />
          <SettingsRow
            label="Manage players"
            value="Remove · reopen spot"
            onPress={() => comingSoon("Managing players")}
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
              {isHost ? "Cancel match" : "Leave match"}
            </Button.Label>
          </Button>
        </Page.Footer>
      ) : canAdd ? (
        <Page.Footer>
          <Button size="lg" onPress={() => setScoreSheet("add")}>
            Add the score
          </Button>
        </Page.Footer>
      ) : canConfirm ? (
        <Page.Footer className="gap-1">
          <Button size="lg" onPress={confirm} isDisabled={confirmScore.isPending}>
            Confirm score
          </Button>
          <Button variant="ghost" onPress={() => setScoreSheet("correct")}>
            <Button.Label className="text-muted">Not right? Enter the real score</Button.Label>
          </Button>
        </Page.Footer>
      ) : canEdit ? (
        <Page.Footer>
          <Button size="lg" variant="secondary" onPress={() => setScoreSheet("edit")}>
            Edit score
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
  if (match.score) return <MatchScoreCard match={{ ...match, score: match.score }} myId={myId} />;
  if (match.isFull === false) {
    return (
      <InfoNote icon={Users} tone="warning" title="No score for this match.">
        It didn’t have 4 players.
      </InfoNote>
    );
  }
  if (canAdd) {
    return (
      <InfoNote icon={Trophy} title="How did it go?">
        Add the score set by set. One player from the other team confirms it.
      </InfoNote>
    );
  }
  if (isTooLateToAdd) {
    return (
      <InfoNote icon={Clock} tone="warning" title="No score was added.">
        The time to add one has passed.
      </InfoNote>
    );
  }
  return (
    <InfoNote icon={Clock} title={`Waiting for ${hostName}’s score.`}>
      {`${hostName} adds it, then one player from the other team confirms it.`}
    </InfoNote>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-16 flex-1 items-center justify-center gap-1 rounded-2xl border border-line bg-surface"
    >
      <Icon as={icon} size={20} color="accent" />
      <Text className="font-bold text-[12px] text-foreground">{label}</Text>
    </PressableFeedback>
  );
}
