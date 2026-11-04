import { SkeletonGroup } from "heroui-native";
import { View } from "react-native";

type UpcomingMatchCardSkeletonProps = {
  /** Screen-reader text for the whole placeholder, e.g. t("matches.loadingMine") */
  label: string;
  count?: number;
};

/** Placeholder cards while your upcoming matches load (same layout as UpcomingMatchCard). */
export function UpcomingMatchCardSkeleton({ label, count = 2 }: UpcomingMatchCardSkeletonProps) {
  return (
    <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} className="gap-2.5">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonGroup
          key={index}
          isLoading
          variant="pulse"
          className="gap-3 rounded-[20px] border border-line bg-surface p-4"
        >
          <View className="flex-row items-center justify-between">
            <SkeletonGroup.Item className="h-4 w-40 rounded-md" />
            <SkeletonGroup.Item className="h-6 w-16 rounded-full" />
          </View>
          <SkeletonGroup.Item className="-mt-1.5 h-3.5 w-3/5 rounded-md" />
          <View className="flex-row">
            {Array.from({ length: 3 }, (_, seat) => (
              <SkeletonGroup.Item key={seat} className={`size-8 rounded-full ${seat > 0 ? "-ms-2" : ""}`} />
            ))}
          </View>
        </SkeletonGroup>
      ))}
    </View>
  );
}
