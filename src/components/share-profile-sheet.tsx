import { Asset, requestPermissionsAsync } from "expo-media-library";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { BottomSheet, cn, Spinner, useToast } from "heroui-native";
import { Download, Link2, QrCode, ScanLine, Share } from "lucide-react-native";
import { Fragment, useRef, useState, type ComponentRef } from "react";
import { useTranslation } from "react-i18next";
import { PixelRatio, Text, View } from "react-native";
// Gesture Handler's Pressable and ScrollView also receive touches inside bottom sheets
import { Pressable, ScrollView } from "react-native-gesture-handler";
import { captureRef } from "react-native-view-shot";

import { Icon } from "@/components/icon";
import { LoadError } from "@/components/load-error";
import { SegmentedControl } from "@/components/segmented-control";
import { ShareProfileCard } from "@/components/share-profile-card";
import { SHARE_IMAGE_WIDTH, ShareProfileImage } from "@/components/share-profile-image";
import { useShareProfile } from "@/hooks/useShareProfile";
import { errorMessage } from "@/lib/error-message";

// The image is laid out at 390 × 694 and captured at story size (1080 × 1920 px). The capture
// size is in points and the screen is 3x, so ask for a third of that.
const SCREEN_SCALE = PixelRatio.get();
const IMAGE_WIDTH = 1080 / SCREEN_SCALE;
const IMAGE_HEIGHT = 1920 / SCREEN_SCALE;
// design: the sheet starts 54 px below the top of the 844 px screen
const SHEET_HEIGHT = "94%";

type ShareAction = "share" | "save";

type ShareProfileSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Scan a code" was picked; the sheet closes and the scanner opens */
  onScan: () => void;
};

/** "Share your profile" (design: Share profile · my code): your QR card, with Share, Copy link and Save image. */
export function ShareProfileSheet({ isOpen, onOpenChange, onScan }: ShareProfileSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { profile, error, refetch, isRefetching } = useShareProfile();
  const image = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState<ShareAction>();

  async function makeImage() {
    return captureRef(image, {
      format: "png",
      result: "tmpfile",
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
    });
  }

  async function run(action: ShareAction, work: (uri: string) => Promise<void>) {
    if (busy) return;
    setBusy(action);
    try {
      await work(await makeImage());
    } catch (failure) {
      toast.show({ variant: "danger", label: t("shareProfile.imageFailed"), description: errorMessage(failure) });
    } finally {
      setBusy(undefined);
    }
  }

  const share = () =>
    run("share", (uri) => Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: t("shareProfile.share") }));

  const save = () =>
    run("save", async (uri) => {
      // Saving only needs permission to add photos, not to read the library
      const permission = await requestPermissionsAsync(true, ["photo"]);
      if (!permission.granted) {
        toast.show({
          variant: "danger",
          label: t("shareProfile.saveDenied"),
          description: t("shareProfile.saveDeniedText"),
        });
        return;
      }
      await Asset.create(uri);
      toast.show({ variant: "success", label: t("shareProfile.imageSaved") });
    });

  async function copyLink() {
    if (!profile) return;
    await Clipboard.setStringAsync(profile.link);
    toast.show({ variant: "success", label: t("shareProfile.linkCopied") });
  }

  return (
    <Fragment>
      {/* Drawn off-screen only to be captured as the image that gets shared or saved */}
      {isOpen && profile ? (
        <View pointerEvents="none" aria-hidden className="absolute top-0" style={{ start: -SHARE_IMAGE_WIDTH * 2 }}>
          <ShareProfileImage ref={image} profile={profile} />
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
            backgroundClassName="bg-background"
            contentContainerClassName="h-full p-0"
            handleIndicatorClassName="h-[5px] w-10 bg-radio-border"
          >
            <ScrollView contentContainerClassName="grow gap-3.5 px-5 pb-[30px] pt-1" showsVerticalScrollIndicator={false}>
              <View className="flex-row items-center justify-between">
                <BottomSheet.Title className="font-black text-[20px] text-foreground">
                  {t("shareProfile.title")}
                </BottomSheet.Title>
                <BottomSheet.Close className="size-9 rounded-full bg-surface" />
              </View>

              <SegmentedControl
                value="code"
                onChange={(tab) => tab === "scan" && onScan()}
                options={[
                  { value: "code", label: t("shareProfile.tabCode"), icon: QrCode },
                  { value: "scan", label: t("shareProfile.tabScan"), icon: ScanLine },
                ]}
              />

              {profile ? (
                <Fragment>
                  <ShareProfileCard profile={profile} />
                  <View className="flex-row gap-2">
                    <ActionButton
                      label={t("shareProfile.share")}
                      icon={Share}
                      primary
                      isBusy={busy === "share"}
                      onPress={share}
                    />
                    <ActionButton label={t("shareProfile.copyLink")} icon={Link2} onPress={copyLink} />
                    <ActionButton
                      label={t("shareProfile.saveImage")}
                      icon={Download}
                      isBusy={busy === "save"}
                      onPress={save}
                    />
                  </View>
                </Fragment>
              ) : error ? (
                <LoadError
                  message={`${t("shareProfile.loadFailed")} ${errorMessage(error)}`}
                  onRetry={() => refetch()}
                  isRetrying={isRefetching}
                />
              ) : (
                <View className="h-[300px] items-center justify-center">
                  <Spinner accessibilityLabel={t("profile.loading")} />
                </View>
              )}
            </ScrollView>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </Fragment>
  );
}

type ActionButtonProps = {
  label: string;
  icon: typeof Share;
  /** The one blue button */
  primary?: boolean;
  isBusy?: boolean;
  onPress: () => void;
};

/** 52 px rounded square with its label underneath (design: Share, Copy link, Save image). */
function ActionButton({ label, icon, primary, isBusy, onPress }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: isBusy }}
      onPress={onPress}
      // Gesture Handler's Pressable takes no className
      style={{ flex: 1, alignItems: "center", gap: 6 }}
    >
      <View
        className={cn(
          "size-[52px] items-center justify-center rounded-[18px]",
          primary ? "bg-accent" : "border border-line bg-surface",
        )}
      >
        <Icon as={icon} size={22} color={primary ? "accent-foreground" : "foreground"} />
      </View>
      <Text className="font-bold text-[12px] text-foreground">{label}</Text>
    </Pressable>
  );
}
