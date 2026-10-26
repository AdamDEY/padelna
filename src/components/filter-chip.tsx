import { cn, PressableFeedback } from "heroui-native";
import { Check } from "lucide-react-native";
import { Text } from "react-native";

import { Icon } from "@/components/icon";

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * Filter pill from design.md: off = white with a light border, on = primary-soft
 * with a tick (colour is never the only signal).
 */
export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      hitSlop={4}
      className={cn(
        "h-9 flex-row items-center gap-1 rounded-full px-3",
        selected ? "bg-primary-soft" : "border border-line-input bg-surface",
      )}
    >
      {selected ? <Icon as={Check} size={14} color="primary-dark" /> : null}
      <Text
        className={cn(
          "text-[13px]",
          selected ? "font-bold text-primary-dark" : "font-semibold text-foreground",
        )}
      >
        {label}
      </Text>
    </PressableFeedback>
  );
}
