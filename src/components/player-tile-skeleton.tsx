import { SkeletonGroup } from "heroui-native";
import { View } from "react-native";

// The two places player faces are laid out as tiles rather than rows
const variants = {
  // "You played with": four to a row, no border (PlayedWithTile)
  tile: { count: 4, item: "flex-1 items-center gap-1", button: "w-16" },
  // Community "new players": bordered 112 px cards in a carousel
  card: {
    count: 3,
    button: "w-24",
    item: "w-[112px] items-center gap-1 rounded-[18px] border border-line bg-surface px-2 pb-2.5 pt-3",
  },
} as const;

type PlayerTileSkeletonProps = {
  variant: keyof typeof variants;
  /** Screen-reader text for the whole placeholder, e.g. t("players.loading") */
  label: string;
};

/** Placeholder faces while the player tiles load. */
export function PlayerTileSkeleton({ variant, label }: PlayerTileSkeletonProps) {
  const { count, item, button } = variants[variant];

  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      className={variant === "tile" ? "flex-row gap-2" : "flex-row gap-2.5"}
    >
      {Array.from({ length: count }, (_, index) => (
        <SkeletonGroup key={index} isLoading variant="pulse" className={item}>
          <SkeletonGroup.Item className="size-12 rounded-full" />
          <SkeletonGroup.Item className="mt-0.5 h-3.5 w-16 rounded-md" />
          {variant === "card" ? <SkeletonGroup.Item className="h-3 w-20 rounded-md" /> : null}
          <SkeletonGroup.Item className={`mt-1 h-8 rounded-xl ${button}`} />
        </SkeletonGroup>
      ))}
    </View>
  );
}
