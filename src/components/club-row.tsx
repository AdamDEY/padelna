import { PressableFeedback } from "heroui-native";
import { ChevronRight } from "lucide-react-native";
import { Text, View } from "react-native";

import { CourtPlaceholder } from "@/components/court-placeholder";
import { Icon } from "@/components/icon";
import type { Club } from "@/types/club";

type ClubRowProps = {
  club: Club;
  onPress?: () => void;
};

/** A club in a list: court thumbnail, name, distance, courts and open matches. */
export function ClubRow({ club, onPress }: ClubRowProps) {
  const details = [
    `${club.distanceKm.toFixed(1)} km`,
    club.courtCount === 1 ? "1 court" : `${club.courtCount} courts`,
    club.openMatchCount === 1 ? "1 open match" : `${club.openMatchCount} open matches`,
  ].join(" · ");

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${club.name}, ${details}`}
    >
      <View className="flex-row items-center gap-3 rounded-[18px] border border-line bg-surface p-2.5">
        <CourtPlaceholder tint={club.placeholderTint} />
        <View className="flex-1">
          <Text numberOfLines={1} className="font-bold text-[15px] text-foreground">
            {club.name}
          </Text>
          <Text numberOfLines={1} className="font-normal text-[13px] text-muted">
            {details}
          </Text>
        </View>
        <Icon as={ChevronRight} size={20} color="muted" />
      </View>
    </PressableFeedback>
  );
}
