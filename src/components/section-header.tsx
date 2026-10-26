import { Pressable, Text, View } from "react-native";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  /** Text link on the right, e.g. "See all" or "Map" */
  actionLabel?: string;
  onPressAction?: () => void;
  /** "sm" (17 px) for sections inside a tab view, "md" (19 px) for main screen sections */
  size?: "sm" | "md";
};

/** H2 section heading from design.md (17–19 px / 900) with an optional link on the right. */
export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onPressAction,
  size = "md",
}: SectionHeaderProps) {
  return (
    <View className="flex-row items-end justify-between gap-3">
      <View className="flex-1">
        <Text
          accessibilityRole="header"
          className={`font-black text-foreground ${size === "sm" ? "text-[17px]" : "text-[19px]"}`}
        >
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
