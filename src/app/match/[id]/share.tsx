import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import * as Sharing from "expo-sharing";
import { setStatusBarStyle } from "expo-status-bar";
import { cn, Spinner, useToast } from "heroui-native";
import { Camera, Copy, Download, Image as ImageIcon, MoreHorizontal, Smartphone, SquareDashed, X, type LucideIcon } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState, type ComponentRef } from "react";
import { useTranslation } from "react-i18next";
import { PixelRatio, Pressable, Share, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { captureRef } from "react-native-view-shot";

import { Icon } from "@/components/icon";
import {
  MatchShareImage,
  MatchShareSticker,
  ScaledShare,
  SHARE_IMAGE_HEIGHT,
  SHARE_IMAGE_WIDTH,
  shareDragRange,
} from "@/components/match-share-image";
import { Page } from "@/components/page";
import { useMatch, useMatchPhotoUrl, useMyPastMatches } from "@/hooks/useMatches";
import { useMyAccount } from "@/hooks/useMyProfile";
import { errorMessage } from "@/lib/error-message";
import { buildMatchShare, canShareScore, SHARE_STYLES, type ShareBackdrop, type ShareStyle } from "@/lib/match-share";
import { matchLinkFor } from "@/lib/share-link";
import { pageStatusBarStyle } from "@/lib/theme-preference";

// The picture is laid out at 390 × 694 and captured at story size (1080 × 1920 px). The capture
// size is in points and the screen is 3x, so ask for a third of that.
const SCREEN_SCALE = PixelRatio.get();
const CAPTURE_WIDTH = 1080 / SCREEN_SCALE;
const CAPTURE_HEIGHT = 1920 / SCREEN_SCALE;
// design: the preview is 236 × 420 and each style thumbnail 54 × 96; the preview is a little smaller
// so the whole screen fits above the buttons without crowding the home indicator
const PREVIEW_WIDTH = 216;
const PREVIEW_SCALE = PREVIEW_WIDTH / SHARE_IMAGE_WIDTH;
const THUMB_WIDTH = 54;
const THUMB_SCALE = THUMB_WIDTH / SHARE_IMAGE_WIDTH;
// A swipe has to travel this far (screen points) to change the style
const SWIPE_DISTANCE = 40;
// The finger has to move this far before a touch counts as a swipe or a drag
const GESTURE_START = 10;

type ShareAction = "primary" | "save" | "more";

const backdrops = [
  { value: "photo", icon: ImageIcon },
  { value: "sticker", icon: Smartphone },
  { value: "plain", icon: SquareDashed },
] as const satisfies { value: ShareBackdrop; icon: LucideIcon }[];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * "Share your match" (design: Share your match · photo + overlay / transparent sticker / exported
 * story image): a finished match's score as a story picture. Pick a photo, one of four overlay
 * styles and where it sits, then send it to a story, save it, or copy it as a transparent sticker.
 */
export default function ShareMatch() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: match, isPending } = useMatch(id);
  const { data: account } = useMyAccount();
  const { data: history = [] } = useMyPastMatches();
  const { data: teamPhotoUrl } = useMatchPhotoUrl(match?.score?.photoPath);

  const pictureRef = useRef<ComponentRef<typeof View>>(null);
  const stickerRef = useRef<ComponentRef<typeof View>>(null);
  const [style, setStyle] = useState<ShareStyle>("score");
  const [backdrop, setBackdrop] = useState<ShareBackdrop>("photo");
  // A photo from the gallery; until then the team photo the host added with the score, if any
  const [pickedUri, setPickedUri] = useState<string>();
  const [offsetY, setOffsetY] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  // The last photo the off-screen picture finished drawing, so a capture never catches it blank
  const [loadedUri, setLoadedUri] = useState<string>();
  const [busy, setBusy] = useState<ShareAction>();
  const photoUri = pickedUri ?? teamPhotoUrl;
  const isSticker = backdrop === "sticker";

  const data = useMemo(
    () => (match?.score && account ? buildMatchShare({ ...match, score: match.score }, account.id, history) : undefined),
    [match, account, history],
  );

  // White status bar over the dark screen
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle(pageStatusBarStyle());
    }, []),
  );

  const range = shareDragRange(style, contentHeight);
  const isReady = !isSticker && photoUri && backdrop === "photo" ? loadedUri === photoUri : true;

  function chooseStyle(next: ShareStyle) {
    setStyle(next);
    // Each style starts where its design puts it
    setOffsetY(0);
  }

  function step(direction: 1 | -1) {
    const index = SHARE_STYLES.indexOf(style);
    chooseStyle(SHARE_STYLES[(index + direction + SHARE_STYLES.length) % SHARE_STYLES.length]);
  }

  // One finger on the preview: sideways changes the style, up and down moves the overlay
  const dragStart = useRef({ offset: 0, startY: 0, isSwipe: false });
  const pan = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-GESTURE_START, GESTURE_START],
    activeOffsetY: [-GESTURE_START, GESTURE_START],
    onActivate: (event) => {
      const { translationX, translationY } = event;
      dragStart.current = { offset: offsetY, startY: translationY, isSwipe: Math.abs(translationX) > Math.abs(translationY) };
    },
    onUpdate: (event) => {
      // A sticker is cut to the overlay, so where it sits on the picture doesn't matter
      if (dragStart.current.isSwipe || isSticker) return;
      const moved = (event.translationY - dragStart.current.startY) / PREVIEW_SCALE;
      setOffsetY(clamp(dragStart.current.offset + moved, range.min, range.max));
    },
    onDeactivate: (event) => {
      const { translationX } = event;
      if (dragStart.current.isSwipe && Math.abs(translationX) > SWIPE_DISTANCE) step(translationX < 0 ? 1 : -1);
    },
  });

  async function pickPhoto() {
    // The library picker doesn't need a permission prompt
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.9 });
    if (!result.canceled) setPickedUri(result.assets[0].uri);
  }

  async function capture(result: "tmpfile" | "base64") {
    if (isSticker) return captureRef(stickerRef, { format: "png", result });
    return captureRef(pictureRef, { format: "png", result, width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT });
  }

  async function run(action: ShareAction, work: () => Promise<void>) {
    if (busy) return;
    setBusy(action);
    try {
      await work();
    } catch (failure) {
      toast.show({ variant: "danger", label: t("matchShare.imageFailed"), description: errorMessage(failure) });
    } finally {
      setBusy(undefined);
    }
  }

  async function shareImage() {
    await Sharing.shareAsync(await capture("tmpfile"), {
      mimeType: "image/png",
      UTI: "public.png",
      dialogTitle: t("matchShare.title"),
    });
  }

  // The sticker goes to the clipboard, so it can be pasted onto a photo in a story
  const copySticker = () =>
    run("primary", async () => {
      await Clipboard.setImageAsync(await capture("base64"));
      toast.show({ variant: "success", label: t("matchShare.stickerCopied"), description: t("matchShare.stickerCopiedText") });
    });

  const story = () => run("primary", shareImage);

  const save = () =>
    run("save", async () => {
      // Saving only needs permission to add photos, not to read the library
      const permission = await requestPermissionsAsync(true, ["photo"]);
      if (!permission.granted) {
        toast.show({ variant: "danger", label: t("matchShare.saveDenied"), description: t("matchShare.saveDeniedText") });
        return;
      }
      await Asset.create(await capture("tmpfile"));
      toast.show({ variant: "success", label: t("matchShare.imageSaved") });
    });

  // The picture goes through the share sheet again for a sticker; for a photo, the match as a message
  const more = () =>
    run("more", async () => {
      if (isSticker) {
        await shareImage();
        return;
      }
      await Share.share({
        message: t("matchShare.message", { club: match?.clubName || t("match.courtNotBooked"), link: matchLinkFor(id) }),
      });
    });

  if (isPending || (!match && !account)) {
    return (
      <Page dark>
        <Page.Body scroll={false} className="items-center justify-center">
          <Spinner color="white" accessibilityLabel={t("matchDetail.loading")} />
        </Page.Body>
      </Page>
    );
  }

  if (!data || !match?.score || !canShareScore(match.score)) {
    return (
      <Page>
        <Page.Header back closeIcon />
        <Page.Body>
          <Page.Title description={t("matchShare.unavailableText")}>{t("matchShare.unavailable")}</Page.Title>
        </Page.Body>
      </Page>
    );
  }

  return (
    <Page dark>
      <Page.Body scroll={false} className="gap-3 px-5 pb-0" >
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            onPress={() => router.back()}
            className="size-11 items-center justify-center rounded-full bg-white/10"
          >
            <Icon as={X} size={20} color="accent-foreground" />
          </Pressable>
          <Text accessibilityRole="header" className="font-black text-[16px] text-white">
            {t("matchShare.title")}
          </Text>
          {backdrop === "photo" ? (
            <Pressable
              accessibilityRole="button"
              onPress={pickPhoto}
              className="h-11 flex-row items-center gap-1.5 rounded-xl bg-white/10 px-3"
            >
              <Icon as={Camera} size={16} color="accent-foreground" />
              <Text className="font-bold text-[13px] text-white">
                {photoUri ? t("matchShare.change") : t("matchShare.addPhoto")}
              </Text>
            </Pressable>
          ) : (
            // Keeps the title in the middle
            <View className="h-11 w-11" />
          )}
        </View>

        <View className="items-center">
          <GestureDetector gesture={pan}>
            <View accessible accessibilityLabel={t("matchShare.previewLabel")}>
              <ScaledShare scale={PREVIEW_SCALE}>
                <MatchShareImage
                  data={data}
                  style={style}
                  backdrop={backdrop}
                  photoUri={photoUri}
                  offsetY={offsetY}
                  showCheckerboard
                  onContentHeight={setContentHeight}
                />
              </ScaledShare>
            </View>
          </GestureDetector>
        </View>
        <Text className="text-center font-normal text-[12px] text-ink-tint-text">
          {t(isSticker ? "matchShare.hintSticker" : "matchShare.hint")}
        </Text>

        <View className="flex-row justify-center gap-3.5" accessibilityRole="radiogroup">
          {SHARE_STYLES.map((option) => {
            const isSelected = option === style;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={t(`matchShare.styles.${option}`)}
                onPress={() => chooseStyle(option)}
                className="items-center gap-1.5"
              >
                <View className={cn("rounded-xl border-2 p-0.5", isSelected ? "border-lime" : "border-transparent")}>
                  <ScaledShare scale={THUMB_SCALE}>
                    <MatchShareImage
                      data={data}
                      style={option}
                      backdrop={backdrop}
                      photoUri={photoUri}
                      showCheckerboard
                    />
                  </ScaledShare>
                </View>
                <Text className={cn("text-[12px]", isSelected ? "font-black text-white" : "font-bold text-ink-tint-text")}>
                  {t(`matchShare.styles.${option}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="flex-row gap-1 rounded-[14px] bg-white/10 p-1" accessibilityRole="tablist">
          {backdrops.map((option) => {
            const isSelected = option.value === backdrop;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setBackdrop(option.value)}
                className={cn("h-[34px] flex-1 flex-row items-center justify-center gap-1.5 rounded-[10px]", isSelected && "bg-surface")}
              >
                <Icon as={option.icon} size={15} color={isSelected ? "foreground" : "ink-tint-text"} />
                <Text className={cn("text-[13px]", isSelected ? "font-black text-foreground" : "font-bold text-ink-tint-text")}>
                  {t(`matchShare.backdrop.${option.value}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-1 flex-row gap-2">
          <ActionButton
            primary
            icon={isSticker ? Copy : Smartphone}
            label={t(isSticker ? "matchShare.copySticker" : "matchShare.story")}
            isBusy={busy === "primary"}
            isDisabled={!isReady}
            onPress={isSticker ? copySticker : story}
          />
          <ActionButton
            icon={Download}
            label={t(isSticker ? "matchShare.savePng" : "matchShare.save")}
            isBusy={busy === "save"}
            isDisabled={!isReady}
            onPress={save}
          />
          <ActionButton
            icon={MoreHorizontal}
            label={t("matchShare.more")}
            isBusy={busy === "more"}
            isDisabled={!isReady}
            onPress={more}
          />
        </View>
      </Page.Body>

      {/* Drawn off-screen only to be captured as the image that gets shared or saved */}
      <View pointerEvents="none" aria-hidden className="absolute top-0" style={{ start: -SHARE_IMAGE_WIDTH * 2 }}>
        <MatchShareImage
          ref={pictureRef}
          data={data}
          style={style}
          backdrop={backdrop}
          photoUri={photoUri}
          offsetY={offsetY}
          onPhotoLoad={setLoadedUri}
        />
      </View>
      {isSticker ? (
        <View pointerEvents="none" aria-hidden className="absolute" style={{ top: SHARE_IMAGE_HEIGHT, start: -SHARE_IMAGE_WIDTH * 2 }}>
          <MatchShareSticker ref={stickerRef} data={data} style={style} />
        </View>
      ) : null}
    </Page>
  );
}

type ActionButtonProps = {
  icon: LucideIcon;
  label: string;
  /** The one blue button */
  primary?: boolean;
  isBusy?: boolean;
  isDisabled?: boolean;
  onPress: () => void;
};

/** 52 px rounded square with its label underneath (design: Story, Save, More). */
function ActionButton({ icon, label, primary, isBusy, isDisabled, onPress }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: isBusy, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      className={cn("flex-1 items-center gap-1.5", isDisabled && "opacity-50")}
    >
      <View className={cn("size-[52px] items-center justify-center rounded-[18px]", primary ? "bg-accent" : "bg-white/10")}>
        {isBusy ? <Spinner size="sm" color="white" /> : <Icon as={icon} size={22} color="accent-foreground" />}
      </View>
      <Text className="font-black text-[12px] text-white">{label}</Text>
    </Pressable>
  );
}
