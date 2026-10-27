import { cn } from "heroui-native";
import { Text, View } from "react-native";

import type { WinRateStat } from "@/types/profile";

// Under this win rate the bar turns orange: something to work on
const WEAK = 35;
// Under this it's lighter blue: fine, but not a strength
const AVERAGE = 50;

/** "Where you win": a titled group of win-rate bars per situation. */
export function WinRateBars({ groups }: { groups: { title: string; stats: WinRateStat[] }[] }) {
  return (
    <View className="gap-3">
      {groups.map((group, groupIndex) => (
        <View key={group.title} className={cn("gap-3", groupIndex > 0 && "mt-1")}>
          <Text className="font-bold text-[12px] uppercase tracking-[0.6px] text-muted">
            {group.title}
          </Text>
          {group.stats.map((stat) => (
            <View
              key={stat.label}
              accessible
              accessibilityLabel={`${stat.label}: ${stat.winRate}% wins`}
              className="gap-1"
            >
              <View className="flex-row justify-between">
                <Text className="font-semibold text-[13px] text-ink-2">{stat.label}</Text>
                <Text className="font-black text-[13px] text-foreground">{stat.winRate}%</Text>
              </View>
              <View className="h-2 rounded-full bg-out-of-range">
                <View
                  className={cn(
                    "h-2 rounded-full",
                    stat.winRate < WEAK
                      ? "bg-dot"
                      : stat.winRate < AVERAGE
                        ? "bg-slot-border"
                        : "bg-accent",
                  )}
                  style={{ width: `${stat.winRate}%` }}
                />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
