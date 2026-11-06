import { router } from "expo-router";
import { BottomSheet, cn, PressableFeedback, Spinner, useToast } from "heroui-native";
import * as ImagePicker from "expo-image-picker";
import { CalendarDays, ChevronRight, Plus } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar, stackTintIndices } from "@/components/player-avatar";
import { SaveScoreSheet } from "@/components/save-score-sheet";
import { useMatch, useShareableMatches, useUploadMatchPhoto } from "@/hooks/useMatches";
import { useMyAccount } from "@/hooks/useMyProfile";
import { formatMatchDay } from "@/lib/format-date";
import type { ShareableMatch } from "@/types/match";
import { errorMessage } from "@/lib/error-message";

const missingCopy = {
  score: { status: "shareMatch.noScore", action: "shareMatch.addScore" },
  photo: { status: "shareMatch.noPhoto", action: "shareMatch.addPhoto" },
} as const;

type ShareMatchSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "Share a match" menu from the Community + button: finish a recent match you hosted
 * (add its score, or a team photo to a score) or log one played elsewhere.
 */
export function ShareMatchSheet({ isOpen, onOpenChange }: ShareMatchSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: account } = useMyAccount();
  const { data: matches, error, refetch, isRefetching } = useShareableMatches(isOpen);
  const uploadPhoto = useUploadMatchPhoto();
  // The match whose score is being added; kept after its sheet closes so it can slide away
  const [scoreMatchId, setScoreMatchId] = useState<string>();
  const [isScoreOpen, setIsScoreOpen] = useState(false);
  const [photoMatchId, setPhotoMatchId] = useState<string>();
  const { data: scoreMatch } = useMatch(scoreMatchId ?? "", scoreMatchId !== undefined);

  function addScore(match: ShareableMatch) {
    setScoreMatchId(match.id);
    setIsScoreOpen(true);
    // The score sheet takes over; the menu isn't needed behind it
    onOpenChange(false);
  }

  async function addPhoto(match: ShareableMatch) {
    // The library picker doesn't need a permission prompt
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.7 });
    if (result.canceled) return;
    setPhotoMatchId(match.id);
    try {
      await uploadPhoto.mutateAsync({ matchId: match.id, uri: result.assets[0].uri });
      toast.show({ variant: "success", label: t("shareMatch.photoAdded") });
    } catch (uploadError) {
      toast.show({
        variant: "danger",
        label: t("shareMatch.photoFailed"),
        description: errorMessage(uploadError),
      });
    } finally {
      setPhotoMatchId(undefined);
    }
  }

  function logMatch() {
    onOpenChange(false);
    router.push("/log-match");
  }

  return (
    <>
      <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
        {/* A plain view instead of iOS's full-window overlay, so the photo library
            opens in front of the sheet instead of behind it */}
        <BottomSheet.Portal disableFullWindowOverlay>
          <BottomSheet.Overlay />
          <BottomSheet.Content
            contentContainerClassName="gap-4 px-5 pb-[34px] pt-1"
            handleIndicatorClassName="h-[5px] w-10 bg-line-input"
          >
            <View className="flex-row items-center justify-between gap-3">
              <BottomSheet.Title className="font-black text-[24px] tracking-[-0.4px] text-foreground">
                {t("shareMatch.title")}
              </BottomSheet.Title>
              <BottomSheet.Close className="size-10 rounded-full bg-fill" />
            </View>

            <View className="gap-2.5">
              <OptionHeader
                icon={<Icon as={CalendarDays} size={22} color="accent" />}
                iconClassName="bg-primary-soft"
                title={t("shareMatch.postRecent")}
                description={t("shareMatch.postRecentText")}
              />
              {matches?.map((match) => (
                <RecentMatchRow
                  key={match.id}
                  match={match}
                  isBusy={photoMatchId === match.id}
                  isDisabled={uploadPhoto.isPending}
                  onPress={() => (match.missing === "score" ? addScore(match) : addPhoto(match))}
                />
              ))}
              {error ? (
                <Text className="font-normal text-[14px] text-muted" onPress={() => !isRefetching && refetch()}>
                  {t("matches.loadMineFailed", { message: errorMessage(error) })} {t("matches.tryAgain")}
                </Text>
              ) : matches === undefined ? (
                <Spinner accessibilityLabel={t("matches.loadingMine")} className="self-start" />
              ) : matches.length === 0 ? (
                <Text className="font-normal text-[14px] leading-5 text-muted">
                  {t("shareMatch.nothingToPost")}
                </Text>
              ) : null}
            </View>

            <View className="h-px bg-line" />

            <PressableFeedback
              onPress={logMatch}
              accessibilityRole="button"
              accessibilityHint={t("shareMatch.logElsewhereText")}
            >
              <View className="flex-row items-center gap-3">
                <OptionHeader
                  icon={<Icon as={Plus} size={22} color="lime-foreground" />}
                  iconClassName="bg-court-lime"
                  title={t("shareMatch.logElsewhere")}
                  description={t("shareMatch.logElsewhereText")}
                />
                <Icon as={ChevronRight} size={20} color="muted" />
              </View>
            </PressableFeedback>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      {scoreMatch && account ? (
        <SaveScoreSheet
          match={scoreMatch}
          myId={account.id}
          mode="add"
          isOpen={isScoreOpen}
          onOpenChange={setIsScoreOpen}
        />
      ) : null}
    </>
  );
}

function OptionHeader({
  icon,
  iconClassName,
  title,
  description,
}: {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  description: string;
}) {
  return (
    <View className="flex-1 flex-row items-center gap-3">
      <View className={cn("size-11 items-center justify-center rounded-[14px]", iconClassName)}>
        {icon}
      </View>
      <View className="flex-1">
        <Text className="font-bold text-[16px] text-foreground">{title}</Text>
        <Text className="font-normal text-[13px] text-muted">{description}</Text>
      </View>
    </View>
  );
}

type RecentMatchRowProps = {
  match: ShareableMatch;
  /** This row's photo is uploading */
  isBusy: boolean;
  isDisabled: boolean;
  onPress: () => void;
};

function RecentMatchRow({ match, isBusy, isDisabled, onPress }: RecentMatchRowProps) {
  const { t } = useTranslation();
  const copy = {
    status: t(missingCopy[match.missing].status),
    action: t(missingCopy[match.missing].action),
  };
  const tintIndices = stackTintIndices(match.players);
  const title = `${formatMatchDay(match.playedAt)} · ${match.clubName}`;

  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${copy.status}. ${copy.action}`}
      className="flex-row items-center gap-3 rounded-2xl border border-line p-3"
    >
      <View className="flex-row">
        {match.players.map((player, index) => (
          <PlayerAvatar
            key={player.id}
            player={player}
            size={26}
            tintIndex={tintIndices[index]}
            ringClassName="border-surface"
            className={index > 0 ? "-ms-2" : undefined}
          />
        ))}
      </View>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={2} className="font-bold text-[14px] text-foreground">
          {title}
        </Text>
        <Text className="font-normal text-[12px] text-muted">{copy.status}</Text>
      </View>
      {isBusy ? (
        <Spinner size="sm" />
      ) : (
        <Text className="font-bold text-[13px] text-accent">{copy.action}</Text>
      )}
    </PressableFeedback>
  );
}
