import { Button, cn } from "heroui-native";
import type { LucideIcon } from "lucide-react-native";

import { Icon } from "@/components/icon";

type IconButtonProps = {
  icon: LucideIcon;
  /** Required: icon-only buttons need an accessible name ("Back", "Notifications") */
  label: string;
  onPress?: () => void;
  className?: string;
};

/** 44 px round icon button from design.md: white fill, 1 px `line` border. */
export function IconButton({ icon, label, onPress, className }: IconButtonProps) {
  return (
    <Button
      variant="outline"
      isIconOnly
      accessibilityLabel={label}
      onPress={onPress}
      className={cn("size-11 rounded-full border-line", className)}
    >
      <Icon as={icon} size={22} />
    </Button>
  );
}
