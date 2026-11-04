import { SkeletonGroup } from "heroui-native";
import { View } from "react-native";

// Same as OpenMatchCard: 36 px seats, and the card width Home passes for the carousel
const SLOT_SIZE = 36;

type OpenMatchCardSkeletonProps = {
  width: number;
};

/** Placeholder card in Home's open matches carousel (same layout as OpenMatchCard). */
export function OpenMatchCardSkeleton({ width }: OpenMatchCardSkeletonProps) {
  return (
    <SkeletonGroup
      isLoading
      variant="pulse"
      className="gap-3 rounded-[20px] border border-line bg-surface p-4"
      style={{ width }}
    >
      <View className="flex-row items-center justify-between">
        <SkeletonGroup.Item className="h-4 w-24 rounded-md" />
        <SkeletonGroup.Item className="h-6 w-16 rounded-lg" />
      </View>
      <SkeletonGroup.Item className="-mt-1.5 h-3.5 w-32 rounded-md" />
      <View className="flex-row gap-1.5">
        {Array.from({ length: 4 }, (_, seat) => (
          <SkeletonGroup.Item key={seat} className="rounded-full" style={{ width: SLOT_SIZE, height: SLOT_SIZE }} />
        ))}
      </View>
      <View className="flex-row items-center justify-between">
        <SkeletonGroup.Item className="h-3.5 w-24 rounded-md" />
        <SkeletonGroup.Item className="h-9 w-16 rounded-xl" />
      </View>
    </SkeletonGroup>
  );
}
