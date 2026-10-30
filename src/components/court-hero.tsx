import { router } from "expo-router";
import { cn } from "heroui-native";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton } from "@/components/icon-button";

const tintClass = {
  blue: "bg-court-blue",
  green: "bg-court-green",
  peach: "bg-court-peach",
  lime: "bg-court-lime",
} as const;

export const COURT_HERO_HEIGHT = 260;

type CourtHeroProps = {
  tint: keyof typeof tintClass;
  /** Shows "1 / N" when the place has photos */
  photoCount?: number;
  /** A lime ball on the court, as on match screens */
  showBall?: boolean;
  /** Round button on the right, e.g. save or share */
  rightAction?: ReactNode;
};

/**
 * Full-width photo area for clubs and matches (render it in a Page.Body without
 * side margins), with a back button and an optional action floating on it.
 * Until real photos exist it shows the tinted court-line placeholder.
 */
export function CourtHero({ tint, photoCount, showBall, rightAction }: CourtHeroProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <View className={cn("overflow-hidden", tintClass[tint])} style={{ height: COURT_HERO_HEIGHT }}>
      {/* Court seen from above: outline, net and service line, running under the sheet */}
      <View aria-hidden className="absolute inset-x-[50px] -bottom-2.5 top-20 rounded border-2 border-white/90" />
      <View aria-hidden className="absolute -bottom-2.5 left-1/2 top-20 w-[3px] bg-white" />
      <View aria-hidden className="absolute inset-x-[50px] top-40 h-0.5 bg-white/70" />
      {showBall ? (
        <View aria-hidden className="absolute left-[58%] top-[118px] size-[18px] rounded-full bg-lime" />
      ) : null}

      {photoCount ? (
        <Text className="absolute bottom-[50px] end-5 overflow-hidden rounded-[10px] bg-ink/55 px-2.5 py-1 font-bold text-[12px] text-white">
          1 / {photoCount}
        </Text>
      ) : null}

      <View className="absolute inset-x-5 flex-row justify-between" style={{ top: insets.top + 8 }}>
        <IconButton icon={ChevronLeft} label={t("common.back")} onPress={goBack} className="border-0 bg-white/90" />
        {rightAction}
      </View>
    </View>
  );
}
