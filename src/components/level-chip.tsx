import { Text, View } from "react-native";

type LevelRangeChipProps = {
  min: number;
  max: number;
};

/** Lime level range chip from design.md: who a match is for, e.g. "4.0 – 5.0". */
export function LevelRangeChip({ min, max }: LevelRangeChipProps) {
  const label = `${min.toFixed(1)} – ${max.toFixed(1)}`;

  return (
    <View
      accessible
      accessibilityLabel={`Level ${min.toFixed(1)} to ${max.toFixed(1)}`}
      className="rounded-[10px] bg-lime-soft px-2 py-1"
    >
      <Text className="font-bold text-[12px] text-lime-foreground">{label}</Text>
    </View>
  );
}
