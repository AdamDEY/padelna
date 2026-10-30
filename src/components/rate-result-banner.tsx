import { PressableFeedback } from "heroui-native";
import { ChevronRight, ShieldCheck, Trophy } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { daysUntil, formatWeekday } from "@/lib/format-date";
import type { PendingReview } from "@/types/match";

type RateResultBannerProps = {
  review: PendingReview;
  onPress?: () => void;
};

const copy = {
  add: { title: "reviewBanner.add", icon: Trophy },
  confirm: { title: "reviewBanner.confirm", icon: ShieldCheck },
} as const;

/** Peach reminder that a finished match's score is waiting for you to add or confirm. */
export function RateResultBanner({ review, onPress }: RateResultBannerProps) {
  const { t } = useTranslation();
  const daysLeft = Math.max(daysUntil(review.closesAt), 0);
  const deadline =
    daysLeft === 0 ? t("reviewBanner.lastDay") : t("reviewBanner.daysLeft", { count: daysLeft });
  const details = t("reviewBanner.details", {
    weekday: formatWeekday(review.playedAt),
    club: review.clubName,
    deadline,
  });
  const { icon } = copy[review.action];
  const title = t(copy[review.action].title);

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${details}`}
    >
      <View className="flex-row items-center gap-3 rounded-[20px] bg-court-peach px-4 py-3.5">
        <View className="size-11 items-center justify-center rounded-full bg-surface">
          <Icon as={icon} size={22} color="avatar-peach-foreground" />
        </View>
        <View className="flex-1">
          <Text className="font-bold text-[15px] text-foreground">{title}</Text>
          <Text className="font-normal text-[13px] text-attention">
            {details}
          </Text>
        </View>
        <Icon as={ChevronRight} size={20} color="avatar-peach-foreground" />
      </View>
    </PressableFeedback>
  );
}
