import { BottomSheet, Button, useToast } from "heroui-native";
import { Trophy } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { ScoreGrid, toBoxes, toSets, type ScoreBoxes } from "@/components/score-grid";
import { TeamPhotoPicker } from "@/components/team-photo-picker";
import { useMatchPhotoUrl, useSubmitScore, useUploadMatchPhoto } from "@/hooks/useMatches";
import { formatMatchDay } from "@/lib/format-date";
import { winningTeam } from "@/lib/padel-score";
import type { MatchDetails } from "@/types/match";
import type { Player } from "@/types/player";
import { errorMessage } from "@/lib/error-message";

type Mode = "add" | "correct" | "edit";

type SaveScoreSheetProps = {
  match: MatchDetails;
  myId: string;
  /** "add": the host's first score; "correct": the other team fixes it; "edit": the sender changes it */
  mode: Mode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** After the score is sent, e.g. to go on to rating the players */
  onSaved?: () => void;
};

/**
 * "Match finished!" sheet where the score is typed set by set (design: Match finished ·
 * save score). One player from the other team then confirms it.
 */
export function SaveScoreSheet({ match, myId, mode, isOpen, onOpenChange, onSaved }: SaveScoreSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const submitScore = useSubmitScore();
  const uploadPhoto = useUploadMatchPhoto();
  const [boxes, setBoxes] = useState<ScoreBoxes>(() => toBoxes(match.score?.sets));
  const [submitted, setSubmitted] = useState(false);
  // A photo picked in this sheet; undefined keeps the saved one (if any)
  const [pickedPhoto, setPickedPhoto] = useState<string>();
  // Only the host adds the team photo, with their score or an edit of it
  const canAddPhoto = match.host?.id === myId && mode !== "correct";
  const { data: savedPhotoUrl } = useMatchPhotoUrl(canAddPhoto ? match.score?.photoPath : undefined);
  const isSaving = submitScore.isPending || uploadPhoto.isPending;

  // Each time the sheet opens, start over; corrections and edits start from the score that was sent
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setBoxes(toBoxes(mode === "add" ? undefined : match.score?.sets));
      setSubmitted(false);
      setPickedPhoto(undefined);
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

  async function save() {
    setSubmitted(true);
    if (!isValid) return;
    try {
      await submitScore.mutateAsync({ matchId: match.id, sets });
    } catch (error) {
      toast.show({
        variant: "danger",
        label: t("scoreSheet.saveFailed"),
        description: errorMessage(error),
      });
      return;
    }

    // The score is what matters; a photo that fails to upload doesn't undo it
    if (pickedPhoto) {
      try {
        await uploadPhoto.mutateAsync({ matchId: match.id, uri: pickedPhoto });
      } catch (error) {
        toast.show({
          variant: "danger",
          label: t("scoreSheet.photoFailed"),
          description: errorMessage(error),
        });
        onOpenChange(false);
        onSaved?.();
        return;
      }
    }

    toast.show({
      variant: "success",
      label: mode === "edit" ? t("scoreSheet.updated") : t("scoreSheet.sent"),
      description: t("scoreSheet.sentText"),
    });
    onOpenChange(false);
    onSaved?.();
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      {/* A plain view instead of iOS's full-window overlay, so the photo library
          opens in front of the sheet instead of behind it */}
      <BottomSheet.Portal disableFullWindowOverlay>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          contentContainerClassName="gap-4 px-5 pb-[34px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          <View className="flex-row items-center gap-3">
            <View className="size-[52px] items-center justify-center rounded-full bg-lime">
              <Icon as={Trophy} size={26} color="on-lime" />
            </View>
            <View className="flex-1">
              <BottomSheet.Title className="font-black text-[24px] tracking-[-0.4px] text-foreground">
                {t(`scoreSheet.title.${mode}`)}
              </BottomSheet.Title>
              <BottomSheet.Description numberOfLines={1} className="font-normal text-[14px] text-muted">
                {[formatMatchDay(match.startsAt), place].filter(Boolean).join(" · ")}
              </BottomSheet.Description>
            </View>
            <BottomSheet.Close className="size-10 rounded-full bg-fill" />
          </View>

          <ScoreGrid teams={teams} myId={myId} boxes={boxes} onChange={setBoxes} isInvalid={scoreError} />

          {scoreError ? (
            <Text accessibilityRole="alert" className="-mt-2 font-semibold text-[13px] text-danger">
              {sets.length === 0
                ? t("scoreSheet.needGames")
                : t("scoreSheet.impossible")}
            </Text>
          ) : null}

          {canAddPhoto ? (
            <TeamPhotoPicker
              uri={pickedPhoto ?? savedPhotoUrl}
              onChange={setPickedPhoto}
              // A saved photo can be replaced, not removed (nothing deletes it yet)
              canRemove={pickedPhoto !== undefined}
            />
          ) : null}

          <View className="gap-2">
            <Text className="text-center font-normal text-[13px] text-muted">
              {t("scoreSheet.confirmNote")}
            </Text>
            <Button size="lg" onPress={save} isDisabled={isSaving}>
              {mode === "edit"
                ? t("scoreSheet.saveChanges")
                : mode === "correct"
                  ? t("scoreSheet.sendReal")
                  : t("scoreSheet.save")}
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
