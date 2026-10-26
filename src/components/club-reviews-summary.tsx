import { cn } from "heroui-native";
import { Text, View } from "react-native";

import type { ClubDetails } from "@/types/club";

// Aspects rated below this show in orange so weak spots stand out
const WEAK_RATING = 4;

type ClubReviewsSummaryProps = {
  club: Pick<ClubDetails, "rating" | "reviewCount" | "ratingBreakdown">;
};

/** Overall rating next to a bar per aspect (court surface, lighting, …). */
export function ClubReviewsSummary({ club }: ClubReviewsSummaryProps) {
  return (
    <View className="flex-row items-center gap-4 rounded-[20px] bg-background p-4">
      <View
        accessible
        accessibilityLabel={`Rated ${club.rating.toFixed(1)} out of 5 by ${club.reviewCount} players`}
        className="w-[76px] items-center gap-0.5"
      >
        <Text className="font-black text-[38px] leading-[40px] tracking-[-1px] text-foreground">
          {club.rating.toFixed(1)}
        </Text>
        <Text className="text-center font-normal text-[12px] text-muted">
          {club.reviewCount} verified players
        </Text>
      </View>

      {/* Aspect bars appear once players have rated them */}
      <View className="flex-1 gap-[7px]">
        {club.ratingBreakdown.map((aspect) => {
          const weak = aspect.value < WEAK_RATING;
          return (
            <View
              key={aspect.label}
              accessible
              accessibilityLabel={`${aspect.label}: ${aspect.value.toFixed(1)} out of 5`}
              className="flex-row items-center gap-2"
            >
              <Text numberOfLines={1} className="w-[92px] font-semibold text-[12px] text-foreground">
                {aspect.label}
              </Text>
              <View className="h-1.5 flex-1 rounded-full bg-line">
                <View
                  className={cn("h-1.5 rounded-full", weak ? "bg-dot" : "bg-accent")}
                  style={{ width: `${(aspect.value / 5) * 100}%` }}
                />
              </View>
              <Text className="w-[26px] text-right font-semibold text-[12px] text-foreground">
                {aspect.value.toFixed(1)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
