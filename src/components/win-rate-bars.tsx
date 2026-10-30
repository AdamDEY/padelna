import { cn } from "heroui-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { translateLabel } from "@/i18n";
import type { WinRateStat } from "@/types/profile";

// Under this win rate the bar turns orange: something to work on
const WEAK = 35;
// Under this it's lighter blue: fine, but not a strength
const AVERAGE = 50;

/** "Where you win": a titled group of win-rate bars per situation. */
export function WinRateBars({ groups }: { groups: { title: string; stats: WinRateStat[] }[] }) {
  // Re-renders with the language; the labels are looked up as they are drawn
  useTranslation();

  return (
    <View className="gap-3">
      {groups.map((group, groupIndex) => (
        <View key={group.title} className={cn("gap-3", groupIndex > 0 && "mt-1")}>
          <Text className="font-bold text-[12px] uppercase tracking-[0.6px] text-muted">
            {translateLabel("winTitles", group.title)}
          </Text>
          {group.stats.map((stat) => (
            <View
              key={stat.label}
              accessible
              accessibilityLabel={`${translateLabel("winStats", stat.label)}: ${stat.winRate}%`}
              className="gap-1"
            >
              <View className="flex-row justify-between">
                <Text className="font-semibold text-[13px] text-ink-2">{translateLabel("winStats", stat.label)}</Text>
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
