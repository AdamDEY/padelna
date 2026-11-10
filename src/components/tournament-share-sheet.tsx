import {
  BottomSheetFooter,
  BottomSheetScrollView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import * as Clipboard from "expo-clipboard";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import * as Sharing from "expo-sharing";
import { BottomSheet, Button, cn, Input, Spinner, Switch, TextField, useBottomSheetAwareHandlers, useToast } from "heroui-native";
import { Download, Link2, Share } from "lucide-react-native";
import { useRef, useState, type ComponentRef } from "react";
import { useTranslation } from "react-i18next";
import { PixelRatio, Text, View } from "react-native";
// Gesture Handler's Pressable also receives touches inside bottom sheets
import { Pressable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import {
  TOURNAMENT_CARD_WIDTH,
  TOURNAMENT_IMAGE_WIDTH,
  TournamentShareCard,
  TournamentShareImage,
} from "@/components/tournament-share-image";
import { errorMessage } from "@/lib/error-message";
import { tournamentLinkFor } from "@/lib/share-link";
import type { ShareResult } from "@/lib/tournament-share";
import type { Player } from "@/types/player";

// The image is laid out at 390 × 694 and captured at story size (1080 × 1920 px). The capture
// size is in points and the screen is 3x, so ask for a third of that.
const SCREEN_SCALE = PixelRatio.get();
const IMAGE_WIDTH = 1080 / SCREEN_SCALE;
const IMAGE_HEIGHT = 1920 / SCREEN_SCALE;
// design: the sheet starts 54 px below the top of the 844 px screen
const SHEET_HEIGHT = "94%";
// design: the preview card is 252 px wide inside the grey panel
const PREVIEW_WIDTH = 252;
const PREVIEW_SCALE = PREVIEW_WIDTH / TOURNAMENT_CARD_WIDTH;
// Room under the form for the pinned "Post to Community" button
const FOOTER_SPACE = 102;
const MAX_CAPTION = 140;

type ShareAction = "share" | "save";

type TournamentShareSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  /** Name of the tournament, for the shared message */
  tournamentName: string;
  result: ShareResult;
  /** The club members who would see the post */
  clubName?: string;
  /** Tagged on the post when I played in pairs */
  partner?: Player;
};

/**
 * "Share your result" (design: Tournament · share result): a preview of the result card, the
 * Community post (not connected yet), Share, Copy link and Save image, and "Post to Community".
 */
export function TournamentShareSheet({
  isOpen,
  onOpenChange,
  tournamentId,
  tournamentName,
  result,
  clubName,
  partner,
}: TournamentShareSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const image = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState<ShareAction>();
  const [isPosting, setIsPosting] = useState(true);
  const [caption, setCaption] = useState("");
  const [cardHeight, setCardHeight] = useState(0);

  async function makeImage() {
    return captureRef(image, { format: "png", result: "tmpfile", width: IMAGE_WIDTH, height: IMAGE_HEIGHT });
  }

  async function run(action: ShareAction, work: (uri: string) => Promise<void>) {
    if (busy) return;
    setBusy(action);
    try {
      await work(await makeImage());
    } catch (failure) {
      toast.show({ variant: "danger", label: t("tournamentShare.imageFailed"), description: errorMessage(failure) });
    } finally {
      setBusy(undefined);
    }
  }

  const share = () =>
    run("share", (uri) =>
      Sharing.shareAsync(uri, {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: t("tournamentShare.shareMessage", { name: tournamentName }),
      }),
    );

  const save = () =>
    run("save", async (uri) => {
      // Saving only needs permission to add photos, not to read the library
      const permission = await requestPermissionsAsync(true, ["photo"]);
      if (!permission.granted) {
        toast.show({
          variant: "danger",
          label: t("tournamentShare.saveDenied"),
          description: t("tournamentShare.saveDeniedText"),
        });
        return;
      }
      await Asset.create(uri);
      toast.show({ variant: "success", label: t("tournamentShare.imageSaved") });
    });

  async function copyLink() {
    await Clipboard.setStringAsync(tournamentLinkFor(tournamentId));
    toast.show({ variant: "success", label: t("tournamentShare.linkCopied") });
  }

  function postToCommunity() {
    // Nothing is posted yet; the Community API will take the image, the caption and the tagged partner
    toast.show({ label: t("tournamentShare.postSoonTitle"), description: t("tournamentShare.postSoonText") });
  }

  return (
    <>
      {/* Drawn off-screen only to be captured as the image that gets shared or saved */}
      {isOpen ? (
        <View pointerEvents="none" aria-hidden className="absolute top-0" style={{ start: -TOURNAMENT_IMAGE_WIDTH * 2 }}>
          <TournamentShareImage ref={image} result={result} />
        </View>
      ) : null}

      <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
        {/* A plain view instead of iOS's full-window overlay, so the share menu opens in front of the sheet */}
        <BottomSheet.Portal disableFullWindowOverlay>
          <BottomSheet.Overlay />
          <BottomSheet.Content
            snapPoints={[SHEET_HEIGHT]}
            enableDynamicSizing={false}
            enableOverDrag={false}
            keyboardBehavior="extend"
            keyboardBlurBehavior="restore"
            backgroundClassName="bg-surface"
            contentContainerClassName="h-full p-0"
            handleIndicatorClassName="h-[5px] w-10 bg-line-input"
            footerComponent={(props: BottomSheetFooterProps) => (
              // Post stays pinned at the bottom while the form scrolls
              <BottomSheetFooter {...props}>
                <View className="bg-surface px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 34) }}>
                  <Button size="lg" isDisabled={!isPosting} onPress={postToCommunity} className="h-14 rounded-[18px]">
                    <Button.Label className="text-[17px]">{t("tournamentShare.post")}</Button.Label>
                  </Button>
                </View>
              </BottomSheetFooter>
            )}
          >
            <View className="flex-row items-center justify-between px-5 pb-3.5 pt-1">
              <BottomSheet.Title className="font-black text-[20px] text-foreground">
                {t("tournamentShare.title")}
              </BottomSheet.Title>
              <BottomSheet.Close className="size-9 rounded-full bg-background" />
            </View>

            <BottomSheetScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: FOOTER_SPACE, gap: 14 }}
            >
              {/* The card as it will look, scaled down inside the grey panel */}
              <View className="items-center rounded-3xl bg-background py-3.5">
                <View style={{ width: PREVIEW_WIDTH, height: cardHeight * PREVIEW_SCALE }}>
                  <View
                    onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
                    // Absolute, so the unscaled card never pushes the panel taller than the scaled one
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: TOURNAMENT_CARD_WIDTH,
                      transform: [{ scale: PREVIEW_SCALE }],
                      transformOrigin: "top left",
                    }}
                  >
                    <TournamentShareCard result={result} />
                  </View>
                </View>
              </View>

              <View className="gap-2.5 rounded-[18px] border border-line px-3.5 py-3">
                <View className="flex-row items-center gap-3">
                  <View className="flex-1">
                    <Text className="font-bold text-[15px] text-foreground">{t("tournamentShare.community")}</Text>
                    <Text className="font-normal text-[12px] text-muted">
                      {clubName ? t("tournamentShare.communityClub", { club: clubName }) : t("tournamentShare.communityAny")}
                    </Text>
                  </View>
                  <Switch
                    isSelected={isPosting}
                    onSelectedChange={setIsPosting}
                    accessibilityLabel={t("tournamentShare.community")}
                  />
                </View>
                {isPosting ? (
                  <>
                    <CaptionField value={caption} onChange={setCaption} />
                    {partner ? (
                      <View className="flex-row items-center gap-2">
                        <PlayerAvatar player={partner} size={22} />
                        <Text className="flex-1 font-normal text-[12px] text-muted">
                          {t("tournamentShare.tagged", { name: partner.firstName })}
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>

              <View className="flex-row gap-2">
                <ActionButton label={t("tournamentShare.share")} icon={Share} isBusy={busy === "share"} onPress={share} />
                <ActionButton label={t("tournamentShare.copyLink")} icon={Link2} onPress={copyLink} />
                <ActionButton label={t("tournamentShare.saveImage")} icon={Download} isBusy={busy === "save"} onPress={save} />
              </View>
            </BottomSheetScrollView>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </>
  );
}

/** Caption box that lifts the sheet when the keyboard opens */
function CaptionField({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const { t } = useTranslation();
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();

  return (
    <TextField>
      <Input
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        maxLength={MAX_CAPTION}
        placeholder={t("tournamentShare.caption")}
        accessibilityLabel={t("tournamentShare.caption")}
        className="h-11 rounded-xl border-0 bg-background"
      />
    </TextField>
  );
}

type ActionButtonProps = {
  label: string;
  icon: typeof Share;
  isBusy?: boolean;
  onPress: () => void;
};

/** 52 px rounded square with its label underneath (design: Copy link, Share, Save image). */
function ActionButton({ label, icon, isBusy, onPress }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: isBusy }}
      onPress={onPress}
      // Gesture Handler's Pressable takes no className
      style={{ flex: 1, alignItems: "center", gap: 6 }}
    >
      <View className={cn("size-[52px] items-center justify-center rounded-[18px] bg-background")}>
        {isBusy ? <Spinner size="sm" /> : <Icon as={icon} size={22} color="foreground" />}
      </View>
      <Text className="font-bold text-[12px] text-foreground">{label}</Text>
    </Pressable>
  );
}
