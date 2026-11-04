import { SkeletonGroup } from "heroui-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

const ROWS = 5;

/** Placeholder rows while My friends loads (same layout as FriendRow). */
export function FriendRowSkeleton() {
  const { t } = useTranslation();

  return (
    <View accessible accessibilityLabel={t("friends.loading")} accessibilityState={{ busy: true }}>
      {Array.from({ length: ROWS }, (_, index) => (
        <SkeletonGroup key={index} isLoading variant="pulse" className="flex-row items-center gap-3 py-2.5">
          <SkeletonGroup.Item className="size-11 rounded-full" />
          <View className="flex-1 gap-2">
            <SkeletonGroup.Item className="h-4 w-2/5 rounded-md" />
            <SkeletonGroup.Item className="h-3 w-3/5 rounded-md" />
          </View>
          <SkeletonGroup.Item className="h-[34px] w-[76px] rounded-xl" />
        </SkeletonGroup>
      ))}
    </View>
  );
}
