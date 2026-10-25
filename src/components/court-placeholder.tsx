import { cn } from "heroui-native";
import { View } from "react-native";

export type CourtTint = "blue" | "green" | "peach" | "lime";

const tintClass: Record<CourtTint, string> = {
  blue: "bg-court-blue",
  green: "bg-court-green",
  peach: "bg-court-peach",
  lime: "bg-court-lime",
};

type CourtPlaceholderProps = {
  tint?: CourtTint;
  /** Square size in px */
  size?: number;
  className?: string;
};

/**
 * Stand-in for club and match photos until real ones exist (design.md
 * "Image placeholders"): a tinted block with a white court outline and net line.
 */
export function CourtPlaceholder({ tint = "blue", size = 52, className }: CourtPlaceholderProps) {
  // Court lines sit about a sixth of the way in, as in the design
  const inset = Math.round(size * 0.17);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn("rounded-[14px]", tintClass[tint], className)}
      style={{ width: size, height: size }}
    >
      <View
        className="absolute rounded-[2px] border-2 border-white/90"
        style={{ top: inset, bottom: inset, left: inset, right: inset }}
      />
      <View
        className="absolute w-0.5 bg-white/90"
        style={{ top: inset, bottom: inset, left: size / 2 - 1 }}
      />
    </View>
  );
}
