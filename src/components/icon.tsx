import type { LucideIcon } from "lucide-react-native";
import { useCSSVariable } from "uniwind";

type IconProps = {
  as: LucideIcon;
  /** Theme colour name from src/global.css, e.g. "foreground", "muted", "accent", "success" */
  color?: string;
  size?: number;
};

/** Lucide icon in the design.md style (1.8 px outline stroke), coloured from the theme. */
export function Icon({ as: LucideComponent, color = "foreground", size = 24 }: IconProps) {
  const resolved = useCSSVariable(`--color-${color}`);

  return (
    <LucideComponent
      size={size}
      color={typeof resolved === "string" ? resolved : undefined}
      strokeWidth={1.8}
    />
  );
}
