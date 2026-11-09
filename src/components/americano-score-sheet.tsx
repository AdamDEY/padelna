import { BottomSheet, Button, cn, Input, useBottomSheetAwareHandlers, useToast } from "heroui-native";
import { Info } from "lucide-react-native";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import { useSubmitAmericanoScore } from "@/hooks/useTournaments";
import {
  americanoScoreError,
  entryOf,
  lineUp,
  pointsOf,
  scoreModeOf,
  shortName,
  toAmericanoScore,
} from "@/lib/americano-live";
import { errorMessage } from "@/lib/error-message";
import type { SetScore } from "@/lib/padel-score";
import type { LiveEntry, LiveMatch, LiveTournament } from "@/types/tournament";
import type { Player } from "@/types/player";

// design: 52 px score boxes
const BOX_SIZE = 52;
const AVATAR_SIZE = 32;

type InputRef = ComponentRef<typeof Input>;

/** A player's face: their account, or the initials of a typed name */
export function faceOf(entry: LiveEntry): Player {
  if (entry.player1) return entry.player1;
  const [firstName, ...rest] = entry.name1.split(" ");
  return { id: entry.id, firstName, lastName: rest.join(" ") };
}

type AmericanoScoreSheetProps = {
  tournament: LiveTournament;
  /** The match to score; undefined closes the sheet */
  match: LiveMatch | undefined;
  onClose: () => void;
};

/** Points for one Americano match, from my side. They count as soon as they're sent. */
export function AmericanoScoreSheet({ tournament, match, onClose }: AmericanoScoreSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const submit = useSubmitAmericanoScore();
  const mode = scoreModeOf(tournament);
  const inputs = useRef<(InputRef | null)[]>([]);
  const pendingFocus = useRef<number>(undefined);
  const [boxes, setBoxes] = useState(["", ""]);
  const [submitted, setSubmitted] = useState(false);

  // The match on screen: it stays while the sheet slides away. Each time a match opens, start
  // from the score that's there, told from my side.
  const [shown, setShown] = useState<LiveMatch>();
  if (match && match.id !== shown?.id) {
    setShown(match);
    setSubmitted(false);
    const points = match.score ? pointsOf(mode, match.score) : undefined;
    const mine = points && (match.mySide === 2 ? [points[1], points[0]] : points);
    setBoxes(mine ? mine.map(String) : ["", ""]);
  }

  useEffect(() => {
    if (pendingFocus.current === undefined) return;
    inputs.current[pendingFocus.current]?.focus();
    pendingFocus.current = undefined;
  }, [boxes]);

  const side = shown?.mySide ?? 1;
  const { partner, opponents } = shown ? lineUp(tournament, shown) : { partner: undefined, opponents: [] };
  const me = entryOf(tournament, tournament.myEntryId);
  const teams = [
    { name: [t("common.you"), shortName(partner)].filter(Boolean).join(" + "), faces: [me, partner] },
    { name: opponents.map(shortName).join(" + "), faces: opponents },
  ];
  const maxDigits = mode === "set4" ? 1 : 2;

  const points: SetScore = [boxes[0] === "" ? NaN : Number(boxes[0]), boxes[1] === "" ? NaN : Number(boxes[1])];
  const error = americanoScoreError(mode, points);
  const showError = submitted && !!error;

  function setBox(index: number, text: string) {
    const digits = text.replace(/[^0-9]/g, "").slice(0, maxDigits);
    setBoxes((current) => current.map((value, i) => (i === index ? digits : value)));
    const isDone = mode === "set4" ? digits !== "" : digits.length === 2 || (digits !== "" && digits !== "1");
    if (isDone && index === 0) pendingFocus.current = 1;
  }

  function send() {
    setSubmitted(true);
    if (!shown || error) return;
    const [mine, theirs] = points;
    submit.mutate(
      { matchId: shown.id, score: toAmericanoScore(mode, side === 1 ? [mine, theirs] : [theirs, mine]) },
      {
        onSuccess: () => {
          toast.show({ variant: "success", label: t("tournaments.americano.scoreSaved") });
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
              <BottomSheet.Title className="font-black text-[20px] text-foreground">{t("tournaments.americano.enterPoints")}</BottomSheet.Title>
              <BottomSheet.Description className="font-normal text-[13px] text-muted">
                {shown ? `${t("tournaments.americano.roundOnly", { round: shown.round })} · ` : ""}
                {t(`tournaments.americano.mode.${mode}`)}
              </BottomSheet.Description>
            </View>
            <BottomSheet.Close className="size-9 rounded-full bg-background" />
          </View>

          <View className="gap-2.5">
            {teams.map((team, index) => (
              <View key={index} className="flex-row items-center gap-2.5">
                <View className="flex-row">
                  {team.faces
                    .filter((entry): entry is LiveEntry => !!entry)
                    .map((entry, faceIndex) => (
                      <PlayerAvatar key={entry.id} player={faceOf(entry)} size={AVATAR_SIZE} ringClassName="border-surface" className={faceIndex > 0 ? "-ms-3" : undefined} />
                    ))}
                </View>
                <Text numberOfLines={1} className="flex-1 font-bold text-[14px] text-foreground">
                  {team.name}
                </Text>
                <ScoreBox
                  ref={(input) => {
                    inputs.current[index] = input;
                  }}
                  value={boxes[index]}
                  onChange={(text) => setBox(index, text)}
                  isInvalid={showError}
                  maxLength={maxDigits}
                  accessibilityLabel={t("tournaments.americano.pointsA11y", { name: team.name })}
                />
              </View>
            ))}
          </View>

          {showError && error ? (
            <Text accessibilityRole="alert" className="-mt-2 font-semibold text-[13px] text-danger">
              {t(`tournaments.americano.scoreError.${error}`)}
            </Text>
          ) : null}

          <View className="flex-row items-start gap-2.5 rounded-[14px] bg-background px-3 py-2.5">
            <Icon as={Info} size={18} color="muted" />
            <Text className="flex-1 font-normal text-[13px] leading-[19px] text-ink-2">{t("tournaments.americano.countsNow")}</Text>
          </View>

          <Button size="lg" onPress={send} isDisabled={submit.isPending}>
            {shown?.score ? t("tournaments.americano.saveCorrection") : t("tournaments.americano.save")}
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
  maxLength: number;
  accessibilityLabel: string;
};

function ScoreBox({ ref, value, onChange, isInvalid, maxLength, accessibilityLabel }: ScoreBoxProps) {
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
      maxLength={maxLength}
      selectTextOnFocus
      accessibilityLabel={accessibilityLabel}
      style={{ width: BOX_SIZE, height: BOX_SIZE }}
      className={cn("rounded-[14px] bg-background px-0 text-center font-black text-[22px]")}
    />
  );
}
