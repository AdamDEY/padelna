import { cn } from "heroui-native";
import { Text, View } from "react-native";

type LevelRangeChipProps = {
  min: number;
  max: number;
  /** Grey chip for a match above or below your level (design.md "Out-of-range chip") */
  outOfRange?: boolean;
};

/** Lime level range chip from design.md: who a match is for, e.g. "4.0 – 5.0". */
export function LevelRangeChip({ min, max, outOfRange }: LevelRangeChipProps) {
  const label = `${min.toFixed(1)} – ${max.toFixed(1)}`;

  return (
    <View
      accessible
      accessibilityLabel={`Level ${min.toFixed(1)} to ${max.toFixed(1)}`}
      className={cn("rounded-[10px] px-2 py-1", outOfRange ? "bg-out-of-range" : "bg-lime-soft")}
    >
      <Text
        className={cn(
          "font-bold text-[12px]",
          outOfRange ? "text-muted" : "text-lime-foreground",
        )}
      >
        {label}
      </Text>
    </View>
  );
}
