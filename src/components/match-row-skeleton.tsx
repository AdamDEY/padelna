import { cn, SkeletonGroup } from "heroui-native";
import { View } from "react-native";

// Same sizes as the real rows: PastMatchRow on the Matches tab, MatchHistoryRow in My history
const sizes = {
  past: { row: "rounded-2xl px-3.5 py-3", box: "size-8 rounded-[10px]", lines: false },
  history: { row: "rounded-[18px] p-3", box: "size-10 rounded-xl", lines: true },
} as const;

type MatchRowSkeletonProps = {
  variant: keyof typeof sizes;
  /** Screen-reader text for the whole placeholder, e.g. t("matches.loadingPast") */
  label: string;
  count?: number;
};

/** Placeholder rows while finished matches load. */
export function MatchRowSkeleton({ variant, label, count = 3 }: MatchRowSkeletonProps) {
  const size = sizes[variant];

  return (
    <View accessible accessibilityLabel={label} accessibilityState={{ busy: true }} className="gap-2.5">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonGroup
          key={index}
          isLoading
          variant="pulse"
          className={cn("flex-row items-center gap-3 border border-line bg-surface", size.row)}
        >
          <SkeletonGroup.Item className={size.box} />
          <View className="flex-1 gap-1.5">
            <SkeletonGroup.Item className="h-3.5 w-1/2 rounded-md" />
            {size.lines ? <SkeletonGroup.Item className="h-3 w-2/3 rounded-md" /> : null}
            <SkeletonGroup.Item className="h-3 w-3/5 rounded-md" />
          </View>
        </SkeletonGroup>
      ))}
    </View>
  );
}
