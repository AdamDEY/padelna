import type { LucideIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

type IconProps = {
  as: LucideIcon;
  /** Theme colour name from src/global.css, e.g. "foreground", "muted", "accent", "success" */
  color?: string;
  size?: number;
  /** Fill the shape with the same colour, e.g. rating stars */
  filled?: boolean;
};

/** Lucide icon in the design.md style (1.8 px outline stroke), coloured from the theme. */
export function Icon({ as: LucideComponent, color = "foreground", size = 24, filled }: IconProps) {
  const resolved = useCSSVariable(`--color-${color}`);
  const colorValue = typeof resolved === "string" ? resolved : undefined;

  return (
    <LucideComponent
      size={size}
      color={colorValue}
      fill={filled ? colorValue : "none"}
      strokeWidth={1.8}
    />
  );
}
