import { PressableFeedback } from "heroui-native";
import { ChevronRight, Star } from "lucide-react-native";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { daysUntil } from "@/lib/format-date";
import type { PendingReview } from "@/types/match";

const weekdayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

type RateResultBannerProps = {
  review: PendingReview;
  onPress?: () => void;
};

/** Peach reminder to add a finished match's result and rate the players. */
export function RateResultBanner({ review, onPress }: RateResultBannerProps) {
  const daysLeft = Math.max(daysUntil(review.closesAt), 0);
  const deadline =
    daysLeft === 0 ? "last day" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`;
  const details = `${weekdayFormat.format(review.playedAt)} match at ${review.clubName} · ${deadline}`;

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Add result and rate players. ${details}`}
    >
      <View className="flex-row items-center gap-3 rounded-[20px] bg-court-peach px-4 py-3.5">
        <View className="size-11 items-center justify-center rounded-full bg-surface">
          <Icon as={Star} size={22} color="avatar-peach-foreground" />
        </View>
        <View className="flex-1">
          <Text className="font-bold text-[15px] text-foreground">Add result & rate players</Text>
          <Text className="font-normal text-[13px] text-attention">
            {details}
          </Text>
        </View>
        <Icon as={ChevronRight} size={20} color="avatar-peach-foreground" />
      </View>
    </PressableFeedback>
  );
}
