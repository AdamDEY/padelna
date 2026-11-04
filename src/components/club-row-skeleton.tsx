import { SkeletonGroup } from "heroui-native";
import { View } from "react-native";

// Same as the 52 px court thumbnail in ClubRow
const THUMBNAIL = 52;

type ClubRowSkeletonProps = {
  /** Screen-reader text for the whole placeholder, e.g. t("home.loadingClubs") */
  label: string;
  count?: number;
};

/** Placeholder rows while the clubs load (same layout as ClubRow). */
export function ClubRowSkeleton({ label, count = 3 }: ClubRowSkeletonProps) {
  return (
    <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} className="gap-2.5">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonGroup
          key={index}
          isLoading
          variant="pulse"
          className="flex-row items-center gap-3 rounded-[18px] border border-line bg-surface p-2.5"
        >
          <SkeletonGroup.Item className="rounded-xl" style={{ width: THUMBNAIL, height: THUMBNAIL }} />
          <View className="flex-1 gap-1.5">
            <SkeletonGroup.Item className="h-4 w-3/5 rounded-md" />
            <SkeletonGroup.Item className="h-3.5 w-4/5 rounded-md" />
          </View>
        </SkeletonGroup>
      ))}
    </View>
  );
}
