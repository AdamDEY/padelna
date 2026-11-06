import { cn, Input, useBottomSheetAwareHandlers } from "heroui-native";
import { t } from "i18next";
import { useRef, type ComponentRef } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { PlayerAvatar, stackTintIndices } from "@/components/player-avatar";
import { isThirdSetPlayed, isValidSet, type SetScore } from "@/lib/padel-score";
import type { Player } from "@/types/player";

// Best of three sets
const SET_COUNT = 3;
// design: 48 px score boxes
const BOX_SIZE = 48;
const THIRD_SET = 2;
// Games 8 and 9 never appear in a normal set, so those keys are ignored in sets 1 and 2
const NORMAL_SET_MAX_DIGIT = 7;

type InputRef = ComponentRef<typeof Input>;

/** One box per team per set, in the order you fill them: set 1 (team 1, team 2), set 2, … */
export type ScoreBoxes = string[];

export function toBoxes(sets: SetScore[] = []): ScoreBoxes {
  return Array.from({ length: SET_COUNT * 2 }, (_, index) => {
    const games = sets[Math.floor(index / 2)]?.[index % 2];
    return games === undefined ? "" : String(games);
  });
}

/** The sets that were filled in; a half-filled set comes back with NaN so it fails validation */
export function toSets(boxes: ScoreBoxes): SetScore[] {
  const sets: SetScore[] = [];
  for (let set = 0; set < SET_COUNT; set++) {
    const [a, b] = [boxes[set * 2], boxes[set * 2 + 1]];
    if (a === "" && b === "") continue;
    sets.push([a === "" ? NaN : Number(a), b === "" ? NaN : Number(b)]);
  }
  return sets;
}

/** A set's games once both boxes are filled; undefined while either is empty */
function setAt(boxes: ScoreBoxes, set: number): SetScore | undefined {
  const [a, b] = [boxes[set * 2], boxes[set * 2 + 1]];
  return a === "" || b === "" ? undefined : [Number(a), Number(b)];
}

/** A team won the first two sets, so there is no third set to play */
function isThirdSetLocked(boxes: ScoreBoxes) {
  return !isThirdSetPlayed(setAt(boxes, 0), setAt(boxes, 1));
}

/** The first set that is filled in but can't be a real score, e.g. 6–5 */
function impossibleSet(boxes: ScoreBoxes) {
  for (let set = 0; set < SET_COUNT; set++) {
    const games = setAt(boxes, set);
    if (games && !isValidSet(games, set)) return set;
  }
  return undefined;
}

/** "You · Amira", or the first names when you're not on the team */
export function teamName(team: Player[], myId: string) {
  const mine = team.find((player) => player.id === myId);
  const others = team.filter((player) => player !== mine).map((player) => player.firstName);
  return (mine ? [t("common.you"), ...others] : others).join(" · ");
}

type ScoreGridProps = {
  /** Team 1 (seats 1–2), then team 2 (seats 3–4) */
  teams: Player[][];
  myId: string;
  boxes: ScoreBoxes;
  onChange: (boxes: ScoreBoxes) => void;
  isInvalid: boolean;
  /** Card colours; the default suits a white sheet */
  className?: string;
};

/**
 * The score typed set by set: a row per team with its avatars and three game boxes
 * (design: Match finished · save score). Works in sheets and on screens.
 */
export function ScoreGrid({ teams, myId, boxes, onChange, isInvalid, className }: ScoreGridProps) {
  const { t } = useTranslation();
  const inputs = useRef<(InputRef | null)[]>([]);

  const thirdSetLocked = isThirdSetLocked(boxes);
  const badSet = impossibleSet(boxes);

  function setBox(index: number, text: string) {
    const set = Math.floor(index / 2);
    // The third set can also be a super tie-break (10–8), so it takes two digits
    const digits = text.replace(/[^0-9]/g, "").slice(0, set === THIRD_SET ? 2 : 1);
    if (set < THIRD_SET && digits !== "" && Number(digits) > NORMAL_SET_MAX_DIGIT) return;

    const next = boxes.map((value, i) => (i === index ? digits : value));
    // Two sets won in a row end the match: clear anything typed in the third set
    onChange(isThirdSetLocked(next) ? next.map((value, i) => (i >= THIRD_SET * 2 ? "" : value)) : next);

    // Typing a number moves on to the next box, set by set. In the third set a 1 may be the start of 10, 11…
    const isDone = set === THIRD_SET ? digits.length === 2 || (digits !== "" && digits !== "1") : digits !== "";
    if (isDone) inputs.current[index + 1]?.focus();
  }

  return (
    <View className={cn("gap-2 rounded-[20px] bg-background p-3.5", className)}>
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 font-bold text-[12px] text-muted">{t("scoreSheet.score")}</Text>
        {Array.from({ length: SET_COUNT }, (_, set) => (
          <Text key={set} style={{ width: BOX_SIZE }} className="text-center font-bold text-[12px] text-muted">
            {t("scoreSheet.set", { number: set + 1 })}
          </Text>
        ))}
      </View>

      {teams.map((team, teamIndex) => {
        const tints = stackTintIndices(team);
        // A team nobody is tagged in yet goes by its letter
        const name = teamName(team, myId) || t("team.name", { team: teamIndex === 0 ? "A" : "B" });
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
                  isInvalid={isInvalid || badSet === set}
                  isDisabled={set === THIRD_SET && thirdSetLocked}
                  isLong={set === THIRD_SET}
                  accessibilityLabel={t("scoreSheet.setA11y", { name, number: set + 1 })}
                />
              );
            })}
          </View>
        );
      })}

      {/* Once the parent shows its own error after Save, that one says it */}
      {badSet !== undefined && !isInvalid ? (
        <Text accessibilityRole="alert" className="font-semibold text-[13px] text-danger">
          {t(badSet === THIRD_SET ? "scoreSheet.badThirdSet" : "scoreSheet.badSet", { number: badSet + 1 })}
        </Text>
      ) : null}
    </View>
  );
}

type ScoreBoxProps = {
  ref: (input: InputRef | null) => void;
  value: string;
  onChange: (text: string) => void;
  isInvalid: boolean;
  /** No third set is played after two straight set wins */
  isDisabled: boolean;
  /** Two digits fit, for a super tie-break */
  isLong: boolean;
  accessibilityLabel: string;
};

/** One set's games for one team; inside a sheet it tells the sheet about the keyboard. */
function ScoreBox({ ref, value, onChange, isInvalid, isDisabled, isLong, accessibilityLabel }: ScoreBoxProps) {
  // Does nothing outside a bottom sheet
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
      // One digit per box (two in the third set); focusing a filled box selects it, so typing replaces it
      maxLength={isLong ? 2 : 1}
      selectTextOnFocus
      editable={!isDisabled}
      accessibilityState={{ disabled: isDisabled }}
      accessibilityLabel={accessibilityLabel}
      style={{ width: BOX_SIZE, height: BOX_SIZE }}
      className={cn("rounded-xl px-0 text-center font-black text-[20px]", isDisabled && "opacity-40")}
    />
  );
}
