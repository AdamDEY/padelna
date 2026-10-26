import { cn, PressableFeedback } from "heroui-native";
import { Text } from "react-native";

import { Page } from "@/components/page";
import { daysUntil } from "@/lib/format-date";

const DAY_WIDTH = 56;
const DAY_GAP = 8;

const weekdayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const fullDateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

type DateStripProps = {
  /** First day shown, usually today */
  start: Date;
  days?: number;
  selected: Date;
  onSelect: (date: Date) => void;
};

/** Row of day tiles to pick which day's matches to show. The selected day is ink. */
export function DateStrip({ start, days = 7, selected, onSelect }: DateStripProps) {
  const dates = Array.from({ length: days }, (_, offset) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    return date;
  });

  return (
    <Page.Carousel itemWidth={DAY_WIDTH} gap={DAY_GAP}>
      {dates.map((date) => {
        const isSelected = daysUntil(date, selected) === 0;

        return (
          <PressableFeedback
            key={date.toISOString()}
            onPress={() => onSelect(date)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={fullDateFormat.format(date)}
            className={cn(
              "h-[72px] items-center justify-center rounded-[18px]",
              isSelected ? "bg-foreground" : "border border-line bg-surface",
            )}
            style={{ width: DAY_WIDTH }}
          >
            <Text
              className={cn(
                "font-semibold text-[12px]",
                isSelected ? "text-ink-tint-text" : "text-muted",
              )}
            >
              {weekdayFormat.format(date)}
            </Text>
            <Text
              className={cn(
                "font-black text-[20px]",
                isSelected ? "text-background" : "text-foreground",
              )}
            >
              {date.getDate()}
            </Text>
          </PressableFeedback>
        );
      })}
    </Page.Carousel>
  );
}
