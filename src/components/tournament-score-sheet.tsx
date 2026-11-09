import { BottomSheet, Button, cn, Input, useBottomSheetAwareHandlers, useToast } from "heroui-native";
import { Clock, Trophy } from "lucide-react-native";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import { useSubmitTournamentScore } from "@/hooks/useTournaments";
import { errorMessage } from "@/lib/error-message";
import type { SetScore } from "@/lib/padel-score";
import {
  entryById,
  entryName,
  flipScore,
  matchTitle,
  needsSuperTiebreak,
  playersOf,
  scoreError,
  scoreWinner,
  WIN_POINTS,
} from "@/lib/tournament-live";
import type { LiveMatch, LiveTournament, TournamentScore } from "@/types/tournament";

// design: 52 px score boxes
const BOX_SIZE = 52;
const AVATAR_SIZE = 32;
// Two sets to 4, then the super tie-break (two digits)
const BOXES = 6;
const TIEBREAK = 2;

type InputRef = ComponentRef<typeof Input>;

/** Boxes in typing order: set 1 (mine, theirs), set 2, super tie-break */
type Boxes = string[];

function toBoxes(score: TournamentScore | undefined): Boxes {
  const sets = [...(score?.sets ?? []), ...(score?.superTiebreak ? [score.superTiebreak] : [])];
  return Array.from({ length: BOXES }, (_, index) => {
    const games = sets[Math.floor(index / 2)]?.[index % 2];
    return games === undefined ? "" : String(games);
  });
}

function setAt(boxes: Boxes, set: number): SetScore | undefined {
  const [a, b] = [boxes[set * 2], boxes[set * 2 + 1]];
  return a === "" || b === "" ? undefined : [Number(a), Number(b)];
}

/** The score as I typed it, from my side */
function toScore(boxes: Boxes): TournamentScore {
  const sets = [setAt(boxes, 0), setAt(boxes, 1)].filter((set): set is SetScore => set !== undefined);
  return { sets, superTiebreak: needsSuperTiebreak(sets) ? setAt(boxes, TIEBREAK) : undefined };
}

type TournamentScoreSheetProps = {
  tournament: LiveTournament;
  /** The match to score; undefined closes the sheet */
  match: LiveMatch | undefined;
  myId?: string;
  onClose: () => void;
};

/** "Enter the score" (design "Tournament live · enter score"). The organiser confirms it. */
export function TournamentScoreSheet({ tournament, match, myId, onClose }: TournamentScoreSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const submit = useSubmitTournamentScore();
  const inputs = useRef<(InputRef | null)[]>([]);
  // The box to move to once the new numbers are on screen: the tie-break only unlocks after a render
  const pendingFocus = useRef<number>(undefined);
  const [boxes, setBoxes] = useState<Boxes>(() => toBoxes(undefined));
  const [submitted, setSubmitted] = useState(false);

  // Start from what was sent, told from my side, each time a match opens
  const [shownId, setShownId] = useState<string>();
  if (match?.id !== shownId) {
    setShownId(match?.id);
    setSubmitted(false);
    const sent = match?.submitted && (match.mySide === 2 ? flipScore(match.submitted) : match.submitted);
    setBoxes(toBoxes(sent));
  }

  const side = match?.mySide ?? 1;
  const mine = entryById(tournament, side === 1 ? match?.entry1Id : match?.entry2Id);
  const theirs = entryById(tournament, side === 1 ? match?.entry2Id : match?.entry1Id);
  const teams = [mine, theirs];

  const score = toScore(boxes);
  const error = scoreError(score);
  const winner = error ? undefined : scoreWinner(score);
  const hasTiebreak = needsSuperTiebreak(score.sets);
  const showError = submitted && !!error;
  // Sets each side won, the super tie-break counting as the deciding set
  const tiebreakSide = score.superTiebreak ? (score.superTiebreak[0] > score.superTiebreak[1] ? 1 : 2) : 0;
  const setsMine = score.sets.filter(([a, b]) => a > b).length + (tiebreakSide === 1 ? 1 : 0);
  const setsTheirs = score.sets.filter(([a, b]) => a < b).length + (tiebreakSide === 2 ? 1 : 0);

  function setBox(index: number, text: string) {
    const isTiebreak = Math.floor(index / 2) === TIEBREAK;
    const digits = text.replace(/[^0-9]/g, "").slice(0, isTiebreak ? 2 : 1);
    // A set is won 4-0 to 4-3, so 5 and up never appear
    if (!isTiebreak && digits !== "" && Number(digits) > 4) return;
    const next = boxes.map((value, i) => (i === index ? digits : value));
    const sets = [setAt(next, 0), setAt(next, 1)].filter((set): set is SetScore => set !== undefined);
    // Two sets won in a row end the match: nothing goes in the tie-break
    setBoxes(sets.length === 2 && !needsSuperTiebreak(sets) ? next.map((value, i) => (i >= TIEBREAK * 2 ? "" : value)) : next);
    const isDone = isTiebreak ? digits.length === 2 || (digits !== "" && digits !== "1") : digits !== "";
    if (isDone) pendingFocus.current = index + 1;
  }

  useEffect(() => {
    if (pendingFocus.current === undefined) return;
    inputs.current[pendingFocus.current]?.focus();
    pendingFocus.current = undefined;
  }, [boxes]);

  function send() {
    setSubmitted(true);
    if (!match || error) return;
    submit.mutate(
      { matchId: match.id, score: side === 1 ? score : flipScore(score) },
      {
        onSuccess: () => {
          toast.show({ variant: "success", label: t("tournaments.score.sent"), description: t("tournaments.score.sentText") });
          onClose();
        },
        onError: (sendError) =>
          toast.show({ variant: "danger", label: t("tournaments.score.sendFailed"), description: errorMessage(sendError) }),
      },
    );
  }

  return (
    <BottomSheet isOpen={!!match} onOpenChange={(open) => !open && onClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          contentContainerClassName="gap-4 px-5 pb-[34px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-0.5">
              <BottomSheet.Title className="font-black text-[20px] text-foreground">{t("tournaments.score.title")}</BottomSheet.Title>
              <BottomSheet.Description className="font-normal text-[13px] text-muted">
                {match ? matchTitle(match) : ""}
              </BottomSheet.Description>
            </View>
            <BottomSheet.Close className="size-9 rounded-full bg-background" />
          </View>

          <View className="gap-2.5">
            {teams.map((entry, team) => {
              const name = entryName(entry, tournament.myEntryId, myId);
              return (
                <View key={entry?.id ?? team} className="flex-row items-center gap-2.5">
                  <View className="flex-row">
                    {playersOf(entry).map((player, index) => (
                      <PlayerAvatar key={player.id} player={player} size={AVATAR_SIZE} ringClassName="border-surface" className={index > 0 ? "-ms-3" : undefined} />
                    ))}
                  </View>
                  <Text numberOfLines={1} className="flex-1 font-bold text-[14px] text-foreground">
                    {name}
                  </Text>
                  {[0, 1, TIEBREAK].map((set) => {
                    const index = set * 2 + team;
                    return (
                      <ScoreBox
                        key={set}
                        ref={(input) => {
                          inputs.current[index] = input;
                        }}
                        value={boxes[index]}
                        onChange={(text) => setBox(index, text)}
                        isInvalid={showError}
                        isDisabled={set === TIEBREAK && !hasTiebreak}
                        isLong={set === TIEBREAK}
                        accessibilityLabel={
                          set === TIEBREAK
                            ? t("tournaments.score.tiebreakA11y", { name })
                            : t("tournaments.score.setA11y", { name, number: set + 1 })
                        }
                      />
                    );
                  })}
                </View>
              );
            })}
            <View className="flex-row justify-end gap-2.5" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {[t("tournaments.score.set", { number: 1 }), t("tournaments.score.set", { number: 2 }), t("tournaments.score.tiebreak")].map((label) => (
                <Text key={label} style={{ width: BOX_SIZE }} className="text-center font-bold text-[11px] text-muted">
                  {label}
                </Text>
              ))}
            </View>
          </View>

          {showError && error ? (
            <Text accessibilityRole="alert" className="-mt-2 font-semibold text-[13px] text-danger">
              {t(`tournaments.score.error.${error}`)}
            </Text>
          ) : winner ? (
            <View className={cn("flex-row items-center gap-2.5 rounded-[14px] px-3 py-2.5", winner === 1 ? "bg-success-soft" : "bg-background")}>
              <Icon as={Trophy} size={18} color={winner === 1 ? "success-soft-foreground" : "muted"} />
              <Text className={cn("flex-1 font-semibold text-[14px]", winner === 1 ? "text-success-soft-foreground" : "text-ink-2")}>
                {winner === 1
                  ? match?.stage === "group"
                    ? t("tournaments.score.youWinGroup", { mine: setsMine, theirs: setsTheirs, points: WIN_POINTS, group: match.groupLabel })
                    : t("tournaments.score.youWin", { mine: setsMine, theirs: setsTheirs })
                  : t("tournaments.score.youLose", { mine: setsMine, theirs: setsTheirs })}
              </Text>
            </View>
          ) : null}

          <View className="flex-row items-start gap-2.5 rounded-[14px] bg-background px-3 py-2.5">
            <Icon as={Clock} size={18} color="muted" />
            <Text className="flex-1 font-normal text-[13px] leading-[19px] text-ink-2">{t("tournaments.score.organiserConfirms")}</Text>
          </View>

          <Button size="lg" onPress={send} isDisabled={submit.isPending}>
            {match?.submitted ? t("tournaments.score.sendAgain") : t("tournaments.score.send")}
          </Button>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

type ScoreBoxProps = {
  ref: (input: InputRef | null) => void;
  value: string;
  onChange: (text: string) => void;
  isInvalid: boolean;
  isDisabled: boolean;
  isLong: boolean;
  accessibilityLabel: string;
};

function ScoreBox({ ref, value, onChange, isInvalid, isDisabled, isLong, accessibilityLabel }: ScoreBoxProps) {
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();
  return (
    <Input
      ref={ref}
      value={value}
      onChangeText={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      isInvalid={isInvalid}
      keyboardType="number-pad"
      maxLength={isLong ? 2 : 1}
      selectTextOnFocus
      editable={!isDisabled}
      accessibilityState={{ disabled: isDisabled }}
      accessibilityLabel={accessibilityLabel}
      style={{ width: BOX_SIZE, height: BOX_SIZE }}
      className={cn("rounded-[14px] bg-background px-0 text-center font-black text-[22px]", isDisabled && "opacity-40")}
    />
  );
}
