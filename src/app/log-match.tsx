import { router } from "expo-router";
import { Button, useToast } from "heroui-native";
import { Clock, Trophy } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { CourtFields } from "@/components/court-fields";
import type { DropdownOption } from "@/components/dropdown";
import { Icon } from "@/components/icon";
import { LogMatchSent } from "@/components/log-match-sent";
import { MatchKindNote } from "@/components/match-kind-note";
import { MatchTimeFields } from "@/components/match-time-fields";
import { Page } from "@/components/page";
import { ScoreGrid, toBoxes, toSets, type ScoreBoxes } from "@/components/score-grid";
import { SegmentedControl } from "@/components/segmented-control";
import { SheetField } from "@/components/sheet-field";
import { TagPlayerSheet } from "@/components/tag-player-sheet";
import { TeamPhotoPicker } from "@/components/team-photo-picker";
import { TeamPicker } from "@/components/team-picker";
import { useBookableClubs } from "@/hooks/useClubs";
import { useLogMatch, useUploadMatchPhoto } from "@/hooks/useMatches";
import { useMyAccount } from "@/hooks/useMyProfile";
import { errorMessage } from "@/lib/error-message";
import { MATCH_MINUTES } from "@/lib/match-time";
import { winningTeam, type SetScore } from "@/lib/padel-score";
import type { Player, PlayerSuggestion } from "@/types/player";

type MatchKind = "friendly" | "competitive";

// How far back a match can be logged (same as the database's 7 days to add a score)
const DAYS_BACK = 7;
// The start-time dropdown runs from 07:00 to 23:00
const FIRST_START_HOUR = 7;
const LAST_START_HOUR = 23;
// When the last finished slot is before the dropdown's first time, default to last night
const FALLBACK_START_HOUR = 19;
const HALF_HOUR_MS = 30 * 60_000;

/** The latest half-hour start whose 90 minutes are over, within the dropdown's hours */
function lastFinishedStart(now: Date) {
  const start = new Date(Math.floor((now.getTime() - MATCH_MINUTES * 60_000) / HALF_HOUR_MS) * HALF_HOUR_MS);
  if (start.getHours() < FIRST_START_HOUR) {
    start.setDate(start.getDate() - 1);
    start.setHours(FALLBACK_START_HOUR, 0, 0, 0);
  } else if (start.getHours() > LAST_START_HOUR) {
    start.setHours(LAST_START_HOUR, 0, 0, 0);
  }
  return start;
}

type Sent = { clubName: string; startsAt: Date; seats: Player[]; sets: SetScore[] };

/**
 * Log a match played outside the app (design: LogMatchV2): where and when, the line-up with
 * the 3 other players tagged, and the score. A player from the other team then confirms it,
 * and the screen turns into the "Sent for confirmation" summary (design: LogMatchSent).
 */
export default function LogMatch() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: account } = useMyAccount();
  const clubs = useBookableClubs();
  const logMatch = useLogMatch();
  const uploadPhoto = useUploadMatchPhoto();
  const [now] = useState(() => new Date());
  const firstDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - DAYS_BACK);

  const [club, setClub] = useState<DropdownOption>();
  const [court, setCourt] = useState<DropdownOption>();
  const [startsAt, setStartsAt] = useState(() => lastFinishedStart(now));
  const [kind, setKind] = useState<MatchKind>("friendly");
  // Seats 2–4; seat 1 is you
  const [tagged, setTagged] = useState<(PlayerSuggestion | undefined)[]>([undefined, undefined, undefined]);
  const [boxes, setBoxes] = useState<ScoreBoxes>(() => toBoxes());
  const [photo, setPhoto] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  // The seat being tagged; kept after the sheet closes so its title doesn't change mid-animation
  const [tagSeat, setTagSeat] = useState(2);
  const [isTagging, setIsTagging] = useState(false);
  const [sent, setSent] = useState<Sent>();

  const me: Player | undefined = account
    ? {
        id: account.id,
        firstName: account.firstName,
        lastName: account.lastName,
        level: account.level,
        avatarUrl: account.avatarUrl,
      }
    : undefined;
  const myId = account?.id ?? "";
  const seats = [me, ...tagged];
  const teams = [seats.slice(0, 2), seats.slice(2, 4)].map((team) =>
    team.filter((player): player is Player => player !== undefined),
  );
  const sets = toSets(boxes);
  const winner = winningTeam(sets);
  // Checked against when the screen opened; the database checks again on send
  const isOver = startsAt.getTime() + MATCH_MINUTES * 60_000 <= now.getTime();
  const isEveryoneTagged = tagged.every((player) => player !== undefined);

  const timeError = !isOver;
  const courtError = submitted && !court;
  const playersError = submitted && !isEveryoneTagged;
  const scoreError = submitted && winner === undefined;

  function openTag(seat: number) {
    setTagSeat(seat);
    setIsTagging(true);
  }

  function tag(player: PlayerSuggestion) {
    setTagged((current) => current.map((item, index) => (index === tagSeat - 2 ? player : item)));
  }

  async function send() {
    setSubmitted(true);
    if (!me || !court || !club || !isEveryoneTagged || winner === undefined || !isOver) return;
    const [partner, ...opponents] = tagged as PlayerSuggestion[];

    let matchId: string;
    try {
      matchId = await logMatch.mutateAsync({
        courtId: court.value,
        startsAt,
        kind,
        partnerId: partner.id,
        opponentIds: [opponents[0].id, opponents[1].id],
        sets,
      });
    } catch (error) {
      toast.show({ variant: "danger", label: t("logMatch.sendFailed"), description: errorMessage(error) });
      return;
    }

    // The match is what matters; a photo that fails to upload doesn't undo it
    if (photo) {
      try {
        await uploadPhoto.mutateAsync({ matchId, uri: photo });
      } catch (error) {
        toast.show({ variant: "danger", label: t("logMatch.photoFailed"), description: errorMessage(error) });
      }
    }
    setSent({ clubName: club.label, startsAt, seats: [me, ...(tagged as Player[])], sets });
  }

  if (sent) {
    return (
      <Page>
        <Page.Header back closeIcon />
        <Page.Body>
          <LogMatchSent {...sent} myId={myId} />
        </Page.Body>
        <Page.Footer>
          <Button size="lg" onPress={() => router.back()}>
            {t("logMatch.done")}
          </Button>
        </Page.Footer>
      </Page>
    );
  }

  return (
    <Page>
      <Page.Header
        back
        leading={
          <View className="flex-1">
            <Text accessibilityRole="header" className="font-black text-[22px] tracking-[-0.3px] text-foreground">
              {t("logMatch.title")}
            </Text>
            <Text className="font-normal text-[13px] text-muted">{t("logMatch.subtitle")}</Text>
          </View>
        }
      />
      <Page.Body className="gap-[18px]">
        <Section title={t("logMatch.whereWhen")}>
          <CourtFields
            clubs={clubs}
            isBooked
            club={club}
            onClubChange={setClub}
            court={court}
            onCourtChange={setCourt}
          />
          {courtError ? <FieldError>{t("logMatch.pickCourt")}</FieldError> : null}
          <MatchTimeFields
            startsAt={startsAt}
            onChange={setStartsAt}
            minimumDate={firstDay}
            maximumDate={now}
            error={timeError ? t("logMatch.notOver") : undefined}
          />
          <SheetField label={t("logMatch.matchType")}>
            <SegmentedControl
              value={kind}
              onChange={setKind}
              options={[
                { value: "friendly", label: t("match.kind.friendly") },
                { value: "competitive", label: t("match.kind.competitive"), icon: Trophy },
              ]}
            />
          </SheetField>
          <MatchKindNote kind={kind} />
        </Section>

        <Section title={t("logMatch.teams")} hint={t("logMatch.teamsHint")}>
          <TeamPicker
            seats={seats}
            myId={myId}
            isTagging
            onBackground
            onSelectSeat={openTag}
            onPlayerPress={(player) => openTag(seats.findIndex((seat) => seat?.id === player.id) + 1)}
          />
          {playersError ? <FieldError>{t("logMatch.tagEveryone")}</FieldError> : null}
        </Section>

        <Section title={t("logMatch.score")}>
          <ScoreGrid
            teams={teams}
            myId={myId}
            boxes={boxes}
            onChange={setBoxes}
            isInvalid={scoreError}
            className="border border-line bg-surface"
          />
          {scoreError ? (
            <FieldError>{sets.length === 0 ? t("scoreSheet.needGames") : t("scoreSheet.impossible")}</FieldError>
          ) : winner !== undefined ? (
            <Text className="font-bold text-[13px] text-success">
              {t("logMatch.teamWins", {
                team: winner === 1 ? "A" : "B",
                won: 2,
                lost: sets.length - 2,
              })}
            </Text>
          ) : null}
          <TeamPhotoPicker uri={photo} onChange={setPhoto} />
        </Section>
      </Page.Body>

      <Page.Footer className="gap-2.5">
        <View className="flex-row gap-2 rounded-xl bg-warning-soft px-3 py-2">
          <View className="pt-0.5">
            <Icon as={Clock} size={16} color="warning" />
          </View>
          <Text className="flex-1 font-normal text-[13px] leading-[18px] text-warning">
            {t("logMatch.confirmNote")}
          </Text>
        </View>
        <Button size="lg" onPress={send} isDisabled={!me || logMatch.isPending || uploadPhoto.isPending}>
          {t("logMatch.send")}
        </Button>
      </Page.Footer>

      <TagPlayerSheet
        isOpen={isTagging}
        onOpenChange={setIsTagging}
        seat={tagSeat}
        current={tagged[tagSeat - 2]}
        takenIds={tagged.filter((player, index) => player && index !== tagSeat - 2).map((player) => player!.id)}
        onTag={tag}
      />
    </Page>
  );
}

/** A numbered part of the form: uppercase label, optional blue hint on the right. */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View className="gap-2.5">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text accessibilityRole="header" className="font-bold text-[12px] uppercase tracking-[0.6px] text-muted">
          {title}
        </Text>
        {hint ? <Text className="shrink font-bold text-[13px] text-accent-text">{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function FieldError({ children }: { children: string }) {
  return (
    <Text accessibilityRole="alert" className="-mt-1 font-semibold text-[13px] text-danger">
      {children}
    </Text>
  );
}
