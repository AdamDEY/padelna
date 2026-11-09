import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { router } from "expo-router";
import { Button, PressableFeedback, useToast } from "heroui-native";
import { ChevronRight, Flashlight, FlashlightOff, QrCode, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import { PlayerSheet } from "@/components/player-sheet";
import { ScannedPlayerSheet } from "@/components/scanned-player-sheet";
import { useMyAccount } from "@/hooks/useMyProfile";
import { playerByCodeQuery, usePlayerByCode } from "@/hooks/usePlayers";
import { errorMessage } from "@/lib/error-message";
import { queryClient } from "@/lib/query-client";
import { codeFromLink } from "@/lib/share-link";

// design: a 250 px frame, its top edge 290 px down the 844 px screen
const FRAME_SIZE = 250;
const FRAME_TOP_RATIO = 290 / 844;
const CORNER_RADIUS = 12;
const CORNER_LENGTH = 32;
const CORNER_STROKE = 4;
// A camera sees the same wrong code many times a second; say so once in a while
const NOT_PADELNA_TOAST_GAP_MS = 3000;

const STRAIGHT = CORNER_LENGTH - CORNER_RADIUS;
// The four L-shaped corners of the frame, clockwise from the top left
const FRAME_CORNERS = [
  `M2 ${CORNER_LENGTH}V${CORNER_RADIUS + 2}a${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 1 ${CORNER_RADIUS} -${CORNER_RADIUS}h${STRAIGHT}`,
  `M${FRAME_SIZE - 2} ${CORNER_LENGTH}V${CORNER_RADIUS + 2}a${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 0 -${CORNER_RADIUS} -${CORNER_RADIUS}h-${STRAIGHT}`,
  `M2 ${FRAME_SIZE - CORNER_LENGTH}v${STRAIGHT - 2}a${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 0 ${CORNER_RADIUS} ${CORNER_RADIUS}h${STRAIGHT}`,
  `M${FRAME_SIZE - 2} ${FRAME_SIZE - CORNER_LENGTH}v${STRAIGHT - 2}a${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 1 -${CORNER_RADIUS} ${CORNER_RADIUS}h-${STRAIGHT}`,
];

/** Scan a player's code (design: "Share profile · scan a code"): the camera, a frame and the player it found. */
export default function ScanCode() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const white = useCSSVariable("--color-accent-foreground") as string;
  const [permission, requestPermission] = useCameraPermissions();
  const { data: me } = useMyAccount();

  const [isTorchOn, setIsTorchOn] = useState(false);
  // The last player whose code was found; scanning another code replaces them
  const [code, setCode] = useState<string>();
  const player = usePlayerByCode(code).data ?? undefined;
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isLookingUp = useRef(false);
  const lastNotPadelnaToast = useRef(0);

  async function lookUp(scanned: string) {
    isLookingUp.current = true;
    try {
      const result = await queryClient.fetchQuery({ ...playerByCodeQuery(scanned), staleTime: 0 });
      if (!result) {
        toast.show({ variant: "danger", label: t("scanCode.notFound"), description: t("scanCode.notFoundText") });
      } else if (result.id === me?.id) {
        toast.show({ label: t("scanCode.yourOwn"), description: t("scanCode.yourOwnText") });
      } else {
        setCode(scanned);
      }
    } catch (error) {
      toast.show({ variant: "danger", label: t("scanCode.failed"), description: errorMessage(error) });
    } finally {
      isLookingUp.current = false;
    }
  }

  function onScanned({ data }: BarcodeScanningResult) {
    // The camera reports the same code many times a second
    if (isLookingUp.current) return;
    const scanned = codeFromLink(data);
    if (scanned) {
      if (scanned !== code) void lookUp(scanned);
      return;
    }
    const now = Date.now();
    if (now - lastNotPadelnaToast.current > NOT_PADELNA_TOAST_GAP_MS) {
      lastNotPadelnaToast.current = now;
      toast.show({ variant: "danger", label: t("scanCode.notPadelna"), description: t("scanCode.notPadelnaText") });
    }
  }

  function showMyCode() {
    router.dismissTo({ pathname: "/profile", params: { share: "1" } });
  }

  const frameTop = Math.round(height * FRAME_TOP_RATIO);
  const frameStart = (width - FRAME_SIZE) / 2;
  const canScan = permission?.granted === true;
  const fullName = player ? `${player.firstName} ${player.lastName}` : "";

  return (
    <View className="flex-1 bg-ink">
      {canScan ? (
        <>
          <View className="absolute inset-0">
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              enableTorch={isTorchOn}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              // Paused while a sheet is open over the camera
              onBarcodeScanned={isSheetOpen || isProfileOpen ? undefined : onScanned}
            />
          </View>

          {/* The camera is dimmed everywhere but inside the frame */}
          <View aria-hidden className="absolute inset-x-0 top-0 bg-ink/55" style={{ height: frameTop }} />
          <View aria-hidden className="absolute inset-x-0 bottom-0 bg-ink/55" style={{ top: frameTop + FRAME_SIZE }} />
          <View aria-hidden className="absolute start-0 bg-ink/55" style={{ top: frameTop, height: FRAME_SIZE, width: frameStart }} />
          <View aria-hidden className="absolute end-0 bg-ink/55" style={{ top: frameTop, height: FRAME_SIZE, width: frameStart }} />
          <Svg aria-hidden width={FRAME_SIZE} height={FRAME_SIZE} style={{ position: "absolute", top: frameTop, left: frameStart }}>
            {FRAME_CORNERS.map((d) => (
              <Path key={d} d={d} fill="none" stroke={white} strokeWidth={CORNER_STROKE} strokeLinecap="round" />
            ))}
          </Svg>

          <Text
            className="absolute inset-x-10 text-center font-bold text-[15px] leading-[22px] text-accent-foreground"
            style={{ top: frameTop - 90 }}
          >
            {t("scanCode.hint")}
          </Text>
        </>
      ) : permission ? (
        <View className="absolute inset-0 items-center justify-center gap-3 px-10">
          <Text accessibilityRole="header" className="text-center font-black text-[20px] text-accent-foreground">
            {t("scanCode.cameraOffTitle")}
          </Text>
          <Text className="text-center font-normal text-[15px] leading-[22px] text-ink-tint-text">
            {t("scanCode.cameraOffText")}
          </Text>
          <Button
            variant="secondary"
            onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
          >
            {permission.canAskAgain ? t("scanCode.allowCamera") : t("scanCode.openSettings")}
          </Button>
        </View>
      ) : null}

      <View className="absolute inset-x-5 flex-row items-center justify-between" style={{ top: insets.top + 8 }}>
        <RoundButton icon={X} label={t("common.close")} onPress={() => router.back()} />
        <Text accessibilityRole="header" className="font-black text-[17px] text-accent-foreground">
          {t("scanCode.title")}
        </Text>
        {canScan ? (
          <RoundButton
            icon={isTorchOn ? FlashlightOff : Flashlight}
            label={t("scanCode.torch")}
            onPress={() => setIsTorchOn((on) => !on)}
          />
        ) : (
          <View className="size-11" />
        )}
      </View>

      <View className="absolute inset-x-5 gap-2.5" style={{ bottom: insets.bottom + 6 }}>
        {player ? (
          <PressableFeedback
            onPress={() => setIsSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("scanCode.found", { name: fullName })}
            className="flex-row items-center gap-3 rounded-[20px] bg-surface p-3"
          >
            <PlayerAvatar player={player} size={44} />
            <View className="flex-1">
              <Text numberOfLines={1} className="font-bold text-[15px] text-foreground">
                {t("scanCode.found", { name: fullName })}
              </Text>
              <Text className="font-normal text-[12px] text-muted">{t("scanCode.foundHint")}</Text>
            </View>
            <Icon as={ChevronRight} size={20} color="muted" />
          </PressableFeedback>
        ) : null}
        <PressableFeedback
          onPress={showMyCode}
          accessibilityRole="button"
          className="h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-white/15"
        >
          <Icon as={QrCode} size={20} color="accent-foreground" />
          <Text className="font-bold text-[15px] text-accent-foreground">{t("scanCode.showMyCode")}</Text>
        </PressableFeedback>
      </View>

      <ScannedPlayerSheet
        player={player}
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onFullProfile={() => {
          setIsSheetOpen(false);
          setIsProfileOpen(true);
        }}
      />
      <PlayerSheet player={player} isOpen={isProfileOpen} onOpenChange={setIsProfileOpen} />
    </View>
  );
}

function RoundButton({ icon, label, onPress }: { icon: typeof X; label: string; onPress: () => void }) {
  return (
    <Button variant="ghost" isIconOnly accessibilityLabel={label} onPress={onPress} className="size-11 rounded-full bg-white/15">
      <Icon as={icon} size={20} color="accent-foreground" />
    </Button>
  );
}
