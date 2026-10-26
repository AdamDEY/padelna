import { PressableFeedback } from "heroui-native";
import { ChevronRight } from "lucide-react-native";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";

type ClubsWeekBannerProps = {
  matchesPlayed: number;
  openForYourLevel: number;
  onPress?: () => void;
};

/** Light blue summary of the week at your clubs, above the My clubs feed. */
export function ClubsWeekBanner({ matchesPlayed, openForYourLevel, onPress }: ClubsWeekBannerProps) {
  const details = `${matchesPlayed} matches played · ${openForYourLevel} open for your level`;

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`This week at your clubs: ${details}`}
    >
      <View className="flex-row items-center gap-3 rounded-[18px] bg-primary-soft px-3.5 py-3">
        {/* Small court mark */}
        <View aria-hidden className="size-10 rounded-xl bg-surface">
          <View className="absolute inset-2 rounded-[2px] border-2 border-slot-border" />
          <View className="absolute bottom-2 top-2 w-0.5 bg-slot-border" style={{ left: 19 }} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-bold text-[14px] text-foreground">This week at your clubs</Text>
          <Text className="font-normal text-[13px] text-primary-dark">{details}</Text>
        </View>
        <Icon as={ChevronRight} size={18} color="primary-dark" />
      </View>
    </PressableFeedback>
  );
}
