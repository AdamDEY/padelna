import { cn } from "heroui-native";
import { Pressable, Text } from "react-native";

import { Page } from "@/components/page";

type ChoiceChipsProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Single-choice pills in a scrolling row (one club, one city). The selected one
 * is solid ink; FilterChip is the multi-select variant with a tick.
 */
export function ChoiceChips<T extends string>({ options, value, onChange }: ChoiceChipsProps<T>) {
  return (
    <Page.Carousel gap={8}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            hitSlop={4}
            className={cn(
              "h-9 justify-center rounded-full px-3.5",
              selected ? "bg-ink" : "border border-line-input bg-surface",
            )}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text
              className={cn(
                "text-[13px]",
                selected ? "font-bold text-white" : "font-semibold text-foreground",
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </Page.Carousel>
  );
}
