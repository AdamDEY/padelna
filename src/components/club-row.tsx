import { PressableFeedback } from "heroui-native";
import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { CourtPlaceholder } from "@/components/court-placeholder";
import { Icon } from "@/components/icon";
import { formatDistance } from "@/lib/club";
import type { ClubCard } from "@/types/club";

type ClubRowProps = {
  club: ClubCard;
  onPress?: () => void;
};

/** A club in a list: court thumbnail, name, distance (or area), courts and open matches. */
export function ClubRow({ club, onPress }: ClubRowProps) {
  const { t } = useTranslation();
  const details = [
    club.distanceKm === undefined ? club.area : formatDistance(club.distanceKm),
    t("club.courts", { count: club.courtCount }),
    t("club.openMatches", { count: club.openMatchCount }),
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
