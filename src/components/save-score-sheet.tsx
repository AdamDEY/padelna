import {
  BottomSheet,
  Button,
  cn,
  Input,
  useBottomSheetAwareHandlers,
  useToast,
} from "heroui-native";
import { Trophy } from "lucide-react-native";
import { useRef, useState, type ComponentRef } from "react";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar, stackTintIndices } from "@/components/player-avatar";
import { useSubmitScore } from "@/hooks/useMatches";
import { formatMatchDay } from "@/lib/format-date";
import { winningTeam, type SetScore } from "@/lib/padel-score";
import type { MatchDetails } from "@/types/match";
import type { Player } from "@/types/player";

// Best of three sets
const SET_COUNT = 3;
// design: 48 px score boxes
const BOX_SIZE = 48;

type InputRef = ComponentRef<typeof Input>;

// One box per team per set, in the order you fill them: set 1 (team 1, team 2), set 2, …
type Boxes = string[];

const titles = {
  add: "Match finished!",
  correct: "Enter the real score",
  edit: "Edit the score",
} as const;

function toBoxes(sets: SetScore[] = []): Boxes {
  return Array.from({ length: SET_COUNT * 2 }, (_, index) => {
    const games = sets[Math.floor(index / 2)]?.[index % 2];
    return games === undefined ? "" : String(games);
  });
}

/** The sets that were filled in; a half-filled set comes back with NaN so it fails validation */
function toSets(boxes: Boxes): SetScore[] {
  const sets: SetScore[] = [];
  for (let set = 0; set < SET_COUNT; set++) {
    const [a, b] = [boxes[set * 2], boxes[set * 2 + 1]];
    if (a === "" && b === "") continue;
    sets.push([a === "" ? NaN : Number(a), b === "" ? NaN : Number(b)]);
  }
  return sets;
}

function teamName(team: Player[], myId: string) {
  const mine = team.find((player) => player.id === myId);
  const others = team.filter((player) => player !== mine).map((player) => player.firstName);
  return (mine ? ["You", ...others] : others).join(" · ");
}

type SaveScoreSheetProps = {
  match: MatchDetails;
  myId: string;
  /** "add": the host's first score; "correct": the other team fixes it; "edit": the sender changes it */
  mode: keyof typeof titles;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "Match finished!" sheet where the score is typed set by set (design: Match finished ·
 * save score). One player from the other team then confirms it.
 */
export function SaveScoreSheet({ match, myId, mode, isOpen, onOpenChange }: SaveScoreSheetProps) {
  const { toast } = useToast();
  const submitScore = useSubmitScore();
  const [boxes, setBoxes] = useState<Boxes>(() => toBoxes(match.score?.sets));
  const [submitted, setSubmitted] = useState(false);
  const inputs = useRef<(InputRef | null)[]>([]);

  // Each time the sheet opens, start over; corrections and edits start from the score that was sent
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setBoxes(toBoxes(mode === "add" ? undefined : match.score?.sets));
      setSubmitted(false);
    }
  }

  const sets = toSets(boxes);
  const isValid = winningTeam(sets) !== undefined;
  const scoreError = submitted && !isValid;

  const seats = match.seats ?? match.players;
  const teams = [seats.slice(0, 2), seats.slice(2, 4)].map((team) =>
    team.filter((player): player is Player => player !== undefined),
  );
  const place = [match.clubName, match.courtName].filter(Boolean).join(" · ");

  function setBox(index: number, text: string) {
    const digit = text.replace(/[^0-9]/g, "");
    setBoxes((current) => current.map((value, i) => (i === index ? digit : value)));
    // Typing a number moves on to the next box, set by set
    if (digit !== "") inputs.current[index + 1]?.focus();
  }

  function save() {
    setSubmitted(true);
    if (!isValid) return;
    submitScore.mutate(
      { matchId: match.id, sets },
      {
        onSuccess: () => {
          toast.show({
            variant: "success",
            label: mode === "edit" ? "Score updated" : "Score sent",
            description: "One player from the other team confirms it.",
          });
          onOpenChange(false);
        },
        onError: (error) =>
          toast.show({ variant: "danger", label: "Couldn’t save the score", description: error.message }),
      },
    );
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          contentContainerClassName="gap-4 px-5 pb-[34px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          <View className="flex-row items-center gap-3">
            <View className="size-[52px] items-center justify-center rounded-full bg-lime">
              <Icon as={Trophy} size={26} color="lime-foreground" />
            </View>
            <View className="flex-1">
              <BottomSheet.Title className="font-black text-[24px] tracking-[-0.4px] text-foreground">
                {titles[mode]}
              </BottomSheet.Title>
              <BottomSheet.Description numberOfLines={1} className="font-normal text-[14px] text-muted">
                {[formatMatchDay(match.startsAt), place].filter(Boolean).join(" · ")}
              </BottomSheet.Description>
            </View>
            <BottomSheet.Close className="size-10 rounded-full bg-fill" />
          </View>

          <View className="gap-2 rounded-[20px] bg-background p-3.5">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 font-bold text-[12px] text-muted">Score</Text>
              {Array.from({ length: SET_COUNT }, (_, set) => (
                <Text
                  key={set}
                  style={{ width: BOX_SIZE }}
                  className="text-center font-bold text-[12px] text-muted"
                >
                  Set {set + 1}
                </Text>
              ))}
            </View>

            {teams.map((team, teamIndex) => {
              const tints = stackTintIndices(team);
              const name = teamName(team, myId);
              return (
                <View key={teamIndex} className="flex-row items-center gap-2">
                  <View className="min-w-0 flex-1 flex-row items-center gap-2">
                    <View className="flex-row">
                      {team.map((player, index) => (
                        <PlayerAvatar
                          key={player.id}
                          player={player}
                          size={28}
                          tintIndex={tints[index]}
                          ringClassName="border-background"
                          className={index > 0 ? "-ms-2" : undefined}
                        />
                      ))}
                    </View>
                    <Text numberOfLines={1} className="flex-1 font-bold text-[14px] text-foreground">
                      {name}
                    </Text>
                  </View>
                  {Array.from({ length: SET_COUNT }, (_, set) => {
                    const index = set * 2 + teamIndex;
                    return (
                      <ScoreBox
                        key={set}
                        ref={(input) => {
                          inputs.current[index] = input;
                        }}
                        value={boxes[index]}
                        onChange={(text) => setBox(index, text)}
                        isInvalid={scoreError}
                        accessibilityLabel={`${name}, set ${set + 1}`}
                      />
                    );
                  })}
                </View>
              );
            })}
          </View>

          {scoreError ? (
            <Text accessibilityRole="alert" className="-mt-2 font-semibold text-[13px] text-danger">
              {sets.length === 0
                ? "Add the games each team won in every set."
                : "That score isn’t possible. A set ends 6–4 or better, 7–5 or 7–6, and a third set is only played at one set all."}
            </Text>
          ) : null}

          <View className="gap-2">
            <Text className="text-center font-normal text-[13px] text-muted">
              One player from the other team confirms the score.
            </Text>
            <Button size="lg" onPress={save} isDisabled={submitScore.isPending}>
              {mode === "edit" ? "Save changes" : mode === "correct" ? "Send the real score" : "Save score"}
            </Button>
          </View>
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
  accessibilityLabel: string;
};

/** One set's games for one team; tells the sheet about the keyboard so it moves above it. */
function ScoreBox({ ref, value, onChange, isInvalid, accessibilityLabel }: ScoreBoxProps) {
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
      // One digit per box; focusing a filled box selects it, so typing replaces it
      maxLength={1}
      selectTextOnFocus
      accessibilityLabel={accessibilityLabel}
      style={{ width: BOX_SIZE, height: BOX_SIZE }}
      className={cn("rounded-xl px-0 text-center font-black text-[20px]")}
    />
  );
}
