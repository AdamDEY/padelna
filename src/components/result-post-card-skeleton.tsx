import { SkeletonGroup } from "heroui-native";
import { View } from "react-native";

type ResultPostCardSkeletonProps = {
  /** Screen-reader text for the whole placeholder, e.g. t("community.loading") */
  label: string;
  count?: number;
};

/** Placeholder cards while a Community feed loads (same layout as ResultPostCard). */
export function ResultPostCardSkeleton({ label, count = 2 }: ResultPostCardSkeletonProps) {
  return (
    <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} className="gap-3">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonGroup
          key={index}
          isLoading
          variant="pulse"
          className="gap-3 rounded-3xl border border-line bg-surface p-3.5"
        >
          <View className="flex-row items-center gap-2.5">
            <View className="flex-row">
              <SkeletonGroup.Item className="size-9 rounded-full" />
              <SkeletonGroup.Item className="-ms-3 size-9 rounded-full" />
            </View>
            <View className="flex-1 gap-1.5">
              <SkeletonGroup.Item className="h-4 w-3/5 rounded-md" />
              <SkeletonGroup.Item className="h-3 w-4/5 rounded-md" />
            </View>
          </View>
          <SkeletonGroup.Item className="h-[180px] w-full rounded-[18px]" />
          <SkeletonGroup.Item className="h-20 w-full rounded-2xl" />
        </SkeletonGroup>
      ))}
    </View>
  );
}
