import { cn, PressableFeedback } from "heroui-native";
import type { ReactNode } from "react";
import { Text } from "react-native";

type OptionTileProps = {
  label: string;
  /** Picture above the label; gets the selected state to recolour itself */
  renderIcon: (isSelected: boolean) => ReactNode;
  isSelected: boolean;
  onPress: () => void;
  /** Smaller label for four tiles in a row */
  compact?: boolean;
  /** Dimmed and not pressable */
  isDisabled?: boolean;
};

/**
 * Square-ish choice tile with an icon over its label (design.md "Option tile").
 * Selected = primary-soft fill with a 2 px primary border.
 */
export function OptionTile({ label, renderIcon, isSelected, onPress, compact, isDisabled }: OptionTileProps) {
  return (
    <PressableFeedback
      onPress={onPress}
      isDisabled={isDisabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
      accessibilityLabel={label}
      className={cn(
        isDisabled && "opacity-40",
        "h-[76px] flex-1 items-center justify-center rounded-2xl",
        compact ? "gap-1.5" : "gap-2",
        isSelected ? "border-2 border-accent bg-primary-soft" : "border border-line-input bg-surface",
      )}
    >
      {renderIcon(isSelected)}
      <Text
        numberOfLines={1}
        className={cn(
          "font-bold",
          compact ? "text-[13px]" : "text-[14px]",
          isSelected ? "text-primary-dark" : "text-foreground",
        )}
      >
        {label}
      </Text>
    </PressableFeedback>
  );
}
