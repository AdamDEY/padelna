import { SkeletonGroup } from "heroui-native";
import { View } from "react-native";

type MatchListItemSkeletonProps = {
  /** Screen-reader text for the whole placeholder, e.g. t("matches.loading") */
  label: string;
  count?: number;
};

/** Placeholder cards while the open matches load (same layout as MatchListItem). */
export function MatchListItemSkeleton({ label, count = 3 }: MatchListItemSkeletonProps) {
  return (
    <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} className="gap-2.5">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonGroup
          key={index}
          isLoading
          variant="pulse"
          className="flex-row gap-3.5 rounded-[20px] border border-line bg-surface p-3.5"
        >
          <SkeletonGroup.Item className="h-[72px] w-[60px] rounded-[14px]" />
          <View className="flex-1 gap-2">
            <SkeletonGroup.Item className="h-4 w-3/5 rounded-md" />
            <View className="flex-row items-center justify-between">
              <View className="flex-row">
                {Array.from({ length: 3 }, (_, seat) => (
                  <SkeletonGroup.Item key={seat} className={`size-[30px] rounded-full ${seat > 0 ? "-ms-2" : ""}`} />
                ))}
              </View>
              <SkeletonGroup.Item className="h-3.5 w-20 rounded-md" />
            </View>
            <SkeletonGroup.Item className="h-3 w-2/5 rounded-md" />
          </View>
        </SkeletonGroup>
      ))}
    </View>
  );
}
