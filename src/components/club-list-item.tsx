import { PressableFeedback } from "heroui-native";
import { Star } from "lucide-react-native";
import { Text, View } from "react-native";

import { CourtPlaceholder } from "@/components/court-placeholder";
import { Icon } from "@/components/icon";
import type { Club } from "@/types/club";

function formatDistance(km: number) {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** A club in the All clubs list: thumbnail, name, rating, place, open matches. */
export function ClubListItem({ club, onPress }: { club: Club; onPress?: () => void }) {
  const details = [
    club.area,
    club.region,
    formatDistance(club.distanceKm),
    club.courtCount === 1 ? "1 court" : `${club.courtCount} courts`,
  ].join(" · ");
  const openMatches =
    club.openMatchCount === 0
      ? null
      : club.openMatchCount === 1
        ? "1 open match"
        : `${club.openMatchCount} open matches`;

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        club.name,
        `rated ${club.rating.toFixed(1)}`,
        details,
        openMatches ?? "no open matches",
        club.isMyClub ? "your club" : null,
      ]
        .filter(Boolean)
        .join(", ")}
    >
      <View className="flex-row items-center gap-3 rounded-[18px] border border-line bg-surface p-2.5">
        <CourtPlaceholder tint={club.placeholderTint} size={56} />
        <View className="min-w-0 flex-1 gap-[3px]">
          <View className="flex-row items-center justify-between gap-2">
            <Text numberOfLines={1} className="flex-1 font-bold text-[15px] text-foreground">
              {club.name}
            </Text>
            <View className="flex-row items-center gap-[3px]">
              <Icon as={Star} size={13} color="star" filled />
              <Text className="font-bold text-[13px] text-foreground">{club.rating.toFixed(1)}</Text>
            </View>
          </View>
          <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
            {details}
          </Text>
          <View className="flex-row items-center gap-1.5">
            {openMatches ? (
              <Text className="overflow-hidden rounded-[9px] bg-lime-soft px-2 py-[3px] font-bold text-[11px] text-lime-foreground">
                {openMatches}
              </Text>
            ) : (
              <Text className="font-semibold text-[11px] text-muted">No open matches</Text>
            )}
            {club.isMyClub ? (
              <Text className="overflow-hidden rounded-[9px] bg-primary-soft px-2 py-[3px] font-bold text-[11px] text-primary-dark">
                Your club
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </PressableFeedback>
  );
}
