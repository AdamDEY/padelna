import { Button, PressableFeedback } from "heroui-native";
import { CalendarDays, ChevronRight, Plus, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { formatWeekdayDay } from "@/lib/format-date";

const SLOT_SIZE = 20;
const SLOT_INSET = 24;

/** White card the empty states sit in (design.md "Card", radius 24) */
function EmptyCard({ children }: { children: React.ReactNode }) {
  return <View className="items-center gap-3.5 rounded-[24px] border border-line bg-surface px-5 pb-[18px] pt-5">{children}</View>;
}

/** Court seen from above with four open spots and a ball */
function CourtIllustration() {
  return (
    <View aria-hidden className="h-20 w-[120px] rounded-2xl bg-primary-soft">
      <View className="absolute inset-x-3.5 inset-y-2.5 rounded-[3px] border-2 border-white" />
      <View className="absolute inset-y-2.5 left-1/2 w-[3px] bg-white" />
      {[
        { corner: "start", top: 17 },
        { corner: "start", top: 43 },
        { corner: "end", top: 17 },
        { corner: "end", top: 43 },
      ].map(({ corner, top }) => (
        <View
          key={`${corner}-${top}`}
          className="absolute rounded-full border-2 border-dashed border-slot-border"
          style={{ top, [corner]: SLOT_INSET, width: SLOT_SIZE, height: SLOT_SIZE }}
        />
      ))}
      <View className="absolute left-[54px] top-[34px] size-3 rounded-full bg-lime" />
    </View>
  );
}

/** Calendar with one day marked by a ball */
function CalendarIllustration() {
  return (
    <View aria-hidden className="h-24 w-28">
      <View className="absolute left-1.5 top-2.5 h-[84px] w-[100px] rounded-[18px] bg-primary-soft" />
      <View className="absolute left-1.5 top-2.5 h-[22px] w-[100px] rounded-t-[18px] bg-accent" />
      <View className="absolute left-[30px] top-0.5 h-[18px] w-2 rounded bg-ink" />
      <View className="absolute right-[30px] top-0.5 h-[18px] w-2 rounded bg-ink" />
      <View className="absolute left-[22px] top-11 w-[72px] flex-row flex-wrap gap-2">
        {Array.from({ length: 8 }, (_, index) => (
          <View
            key={index}
            className={index === 2 ? "size-3 rounded-full bg-lime" : "h-3 w-3 rounded bg-white"}
          />
        ))}
      </View>
    </View>
  );
}

type OpenMatchesEmptyProps = {
  /** The day with no matches */
  day: Date;
  level: number;
  onCreate: () => void;
  /** The nearest other day that has matches at the player's level */
  suggestion?: { date: Date; count: number };
  onPickSuggestion: (date: Date) => void;
};

/** Matches · Open when nothing is posted that day (design canvas "Matches · Open · empty state"). */
export function OpenMatchesEmpty({ day, level, onCreate, suggestion, onPickSuggestion }: OpenMatchesEmptyProps) {
  const { t } = useTranslation();
  const dayLabel = formatWeekdayDay(day);

  return (
    <View className="gap-4">
      <EmptyCard>
        <CourtIllustration />
        <View className="items-center gap-1.5">
          <Text accessibilityRole="header" className="text-center font-black text-[19px] text-foreground">
            {t("matches.emptyOpenTitle", { day: dayLabel })}
          </Text>
          <Text className="text-center font-normal text-[14px] leading-[20px] text-muted">
            {t("matches.emptyOpenBody", { level: level.toFixed(1) })}
          </Text>
        </View>
        <Button size="lg" onPress={onCreate} className="self-stretch">
          <Icon as={Plus} size={18} color="accent-foreground" />
          <Button.Label>{t("matches.emptyOpenCreate", { day: dayLabel })}</Button.Label>
        </Button>
      </EmptyCard>

      {suggestion ? (
        <View className="gap-2">
          <Text className="font-bold text-[12px] uppercase tracking-[0.6px] text-muted">{t("matches.orTry")}</Text>
          <PressableFeedback
            accessibilityRole="button"
            accessibilityLabel={`${formatWeekdayDay(suggestion.date)}, ${t("matches.suggestionCount", { count: suggestion.count })}`}
            onPress={() => onPickSuggestion(suggestion.date)}
            className="h-[52px] flex-row items-center gap-3 rounded-2xl border border-line bg-surface px-3.5"
          >
            <View className="size-8 items-center justify-center rounded-[10px] bg-primary-soft">
              <Icon as={CalendarDays} size={18} color="accent-text" />
            </View>
            <Text className="flex-1 font-bold text-[15px] text-foreground" numberOfLines={1}>
              {formatWeekdayDay(suggestion.date)}
              <Text className="font-semibold text-muted">
                {" · "}
                {t("matches.suggestionCount", { count: suggestion.count })}
              </Text>
            </Text>
            <Icon as={ChevronRight} size={18} color="muted-icon" />
          </PressableFeedback>
        </View>
      ) : null}
    </View>
  );
}

type MyMatchesEmptyProps = {
  onFind: () => void;
  onCreate: () => void;
};

/** Matches · Mine before any match (design canvas "Matches · Mine · empty state"). */
export function MyMatchesEmpty({ onFind, onCreate }: MyMatchesEmptyProps) {
  const { t } = useTranslation();

  return (
    <EmptyCard>
      <CalendarIllustration />
      <View className="items-center gap-1.5">
        <Text accessibilityRole="header" className="text-center font-black text-[19px] text-foreground">
          {t("matches.emptyMineTitle")}
        </Text>
        <Text className="text-center font-normal text-[14px] leading-[20px] text-muted">
          {t("matches.emptyMineBody")}
        </Text>
      </View>
      <View className="gap-2 self-stretch">
        <Button size="lg" onPress={onFind}>
          <Icon as={Search} size={18} color="accent-foreground" />
          <Button.Label>{t("matches.findOpenMatch")}</Button.Label>
        </Button>
        <Button size="lg" variant="secondary" onPress={onCreate}>
          <Icon as={Plus} size={18} color="accent-soft-foreground" />
          <Button.Label>{t("home.createMatchAction")}</Button.Label>
        </Button>
      </View>
    </EmptyCard>
  );
}
