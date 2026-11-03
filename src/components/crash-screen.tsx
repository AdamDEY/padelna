import type { ErrorBoundaryProps } from "expo-router";
import { TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";

// design.md: pinned primary button 34 px from the bottom edge
const BOTTOM_ACTION = 34;

/**
 * What a player sees when a screen crashes. It's the root layout's ErrorBoundary, so it renders
 * outside HeroUINativeProvider and the query client: only plain React Native and Uniwind here.
 */
export function CrashScreen({ retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 justify-between bg-background px-6"
      style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, BOTTOM_ACTION) }}
    >
      <View className="flex-1 items-center justify-center gap-3">
        <View className="size-16 items-center justify-center rounded-full bg-attention-soft">
          <Icon as={TriangleAlert} size={28} color="attention" />
        </View>
        <Text
          accessibilityRole="header"
          className="text-center font-black text-[24px] tracking-[-0.4px] text-foreground"
        >
          {t("errors.crashTitle")}
        </Text>
        <Text className="text-center font-normal text-[16px] leading-[24px] text-ink-2">
          {t("errors.crashText")}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        className="h-[56px] items-center justify-center rounded-[18px] bg-accent"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <Text className="font-bold text-[17px] text-accent-foreground">{t("errors.tryAgain")}</Text>
      </Pressable>
    </View>
  );
}
