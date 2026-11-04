import { SkeletonGroup } from "heroui-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

// Matches the loaded rows: a 44 px avatar and two lines of text
const ROWS = 5;

/** Placeholder rows while the notifications load (same layout as NotificationRow). */
export function NotificationRowSkeleton() {
  const { t } = useTranslation();

  return (
    <View accessible accessibilityLabel={t("notifications.loading")} accessibilityState={{ busy: true }}>
      {Array.from({ length: ROWS }, (_, index) => (
        <SkeletonGroup
          key={index}
          isLoading
          variant="pulse"
          className="flex-row gap-3 border-b border-line-soft px-5 py-3"
        >
          <SkeletonGroup.Item className="size-11 rounded-full" />
          <View className="flex-1 gap-2 pt-0.5">
            <SkeletonGroup.Item className="h-3.5 w-full rounded-md" />
            <SkeletonGroup.Item className="h-3.5 w-3/5 rounded-md" />
            <SkeletonGroup.Item className="h-3 w-1/4 rounded-md" />
          </View>
        </SkeletonGroup>
      ))}
    </View>
  );
}
