import { cn, PressableFeedback } from "heroui-native";
import { Check } from "lucide-react-native";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";

type AnswerCardProps = {
  label: string;
  isSelected: boolean;
  onPress: () => void;
};

/**
 * One answer in a single-choice question, with a radio circle on the left
 * (design.md "Answer card"). Selected = primary-soft, 2 px border and a tick.
 */
export function AnswerCard({ label, isSelected, onPress }: AnswerCardProps) {
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={label}
      className={cn(
        "min-h-[60px] flex-row items-center gap-3 rounded-2xl px-4 py-2.5",
        isSelected ? "border-2 border-accent bg-primary-soft" : "border border-line-input bg-surface",
      )}
    >
      {isSelected ? (
        <View className="size-[22px] items-center justify-center rounded-full bg-accent">
          <Icon as={Check} size={13} color="accent-foreground" />
        </View>
      ) : (
        <View className="size-[22px] rounded-full border-2 border-radio-border" />
      )}
      <Text
        className={cn(
          "flex-1 text-[16px] leading-[21px]",
          isSelected ? "font-bold text-primary-dark" : "font-semibold text-foreground",
        )}
      >
        {label}
      </Text>
    </PressableFeedback>
  );
}
