import { SkeletonGroup } from "heroui-native";
import { View } from "react-native";

type PlayerRowSkeletonProps = {
  /** Screen-reader text for the whole placeholder, e.g. t("players.loading") */
  label: string;
  count?: number;
};

/** Placeholder rows while player lists load (same layout as PlayerSuggestionRow). */
export function PlayerRowSkeleton({ label, count = 3 }: PlayerRowSkeletonProps) {
  return (
    <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} className="gap-2">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonGroup
          key={index}
          isLoading
          variant="pulse"
          className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5"
        >
          <SkeletonGroup.Item className="size-10 rounded-full" />
          <View className="flex-1 gap-1.5">
            <SkeletonGroup.Item className="h-4 w-2/5 rounded-md" />
            <SkeletonGroup.Item className="h-3 w-3/5 rounded-md" />
          </View>
          <SkeletonGroup.Item className="h-9 w-[84px] rounded-xl" />
        </SkeletonGroup>
      ))}
    </View>
  );
}
