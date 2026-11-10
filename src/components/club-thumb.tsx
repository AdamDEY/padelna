import { Image } from "expo-image";
import { View } from "react-native";

import { CourtPlaceholder } from "@/components/court-placeholder";
import type { ClubCard } from "@/types/club";

/** The club's logo on its cards, or the court placeholder until the club has one. */
export function ClubThumb({ club, size = 52 }: { club: ClubCard; size?: number }) {
  if (!club.logoUrl) return <CourtPlaceholder tint={club.placeholderTint} size={size} />;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="overflow-hidden rounded-[14px] bg-fill"
      style={{ width: size, height: size }}
    >
      <Image
        source={{ uri: club.logoUrl }}
        contentFit="cover"
        transition={150}
        style={{ width: size, height: size }}
      />
    </View>
  );
}
