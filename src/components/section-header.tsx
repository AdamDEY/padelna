import { Pressable, Text, View } from "react-native";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  /** Text link on the right, e.g. "See all" or "Map" */
  actionLabel?: string;
  onPressAction?: () => void;
};

/** H2 section heading from design.md (19 px / 900) with an optional link on the right. */
export function SectionHeader({ title, subtitle, actionLabel, onPressAction }: SectionHeaderProps) {
  return (
    <View className="flex-row items-end justify-between gap-3">
      <View className="flex-1">
        <Text accessibilityRole="header" className="font-black text-[19px] text-foreground">
          {title}
        </Text>
        {subtitle ? <Text className="font-normal text-[13px] text-muted">{subtitle}</Text> : null}
      </View>
      {actionLabel ? (
        <Pressable accessibilityRole="link" onPress={onPressAction} hitSlop={12}>
          {({ pressed }) => (
            <Text className={`font-bold text-[14px] ${pressed ? "text-primary-dark" : "text-link"}`}>
              {actionLabel}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
