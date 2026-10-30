import { Button, cn } from "heroui-native";
import type { LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Icon } from "@/components/icon";

type IconButtonProps = {
  icon: LucideIcon;
  /** Required: icon-only buttons need an accessible name ("Back", "Notifications") */
  label: string;
  /** Orange unread dot in the top corner */
  showDot?: boolean;
  /** "primary" = solid blue, for the one main action in a header (e.g. Share a match) */
  variant?: "outline" | "primary";
  /** Filled icon, for on/off states like a saved heart */
  filled?: boolean;
  onPress?: () => void;
  className?: string;
};

/** 44 px round icon button from design.md: white fill, 1 px `line` border. */
export function IconButton({
  icon,
  label,
  showDot,
  variant = "outline",
  filled,
  onPress,
  className,
}: IconButtonProps) {
  const { t } = useTranslation();
  const isPrimary = variant === "primary";

  return (
    <Button
      variant={isPrimary ? "primary" : "outline"}
      isIconOnly
      accessibilityLabel={showDot ? t("common.unread", { label }) : label}
      onPress={onPress}
      className={cn("size-11 rounded-full", !isPrimary && "border-line", className)}
    >
      <Icon
        as={icon}
        size={22}
        color={isPrimary ? "accent-foreground" : filled ? "dot" : "foreground"}
        filled={filled}
      />
      {showDot ? (
        <View className="absolute end-[11px] top-[10px] size-2 rounded-full bg-dot" />
      ) : null}
    </Button>
  );
}
