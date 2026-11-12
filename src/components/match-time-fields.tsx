import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { CalendarDays } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Text, View } from "react-native";
// Gesture Handler's Pressable: React Native's doesn't get taps inside a sheet
import { Pressable as GesturePressable } from "react-native-gesture-handler";
import { useCSSVariable } from "uniwind";

import { Dropdown } from "@/components/dropdown";
import { Icon } from "@/components/icon";
import { SheetField } from "@/components/sheet-field";
import { dateLocale, formatMatchDay } from "@/lib/format-date";
import { clockTime, MATCH_MINUTES, TIME_OPTIONS, withDay, withTime } from "@/lib/match-time";

type MatchTimeFieldsProps = {
  startsAt: Date;
  onChange: (startsAt: Date) => void;
  minimumDate: Date;
  maximumDate: Date;
  /** Shows the "That time has passed" line under the fields */
  isInPast?: boolean;
  /** Another line to show under the fields instead */
  error?: string;
};

/**
 * Date and start time side by side (design: Create match (sheet)): the native date picker
 * and a half-hour dropdown that shows when the 90 minutes end. For sheets that use
 * `<BottomSheet.Portal disableFullWindowOverlay>`, or the iOS picker renders blank.
 */
export function MatchTimeFields({
  startsAt,
  onChange,
  minimumDate,
  maximumDate,
  isInPast,
  error,
}: MatchTimeFieldsProps) {
  const { t } = useTranslation();
  const accent = useCSSVariable("--color-accent") as string;
  const endsAt = new Date(startsAt.getTime() + MATCH_MINUTES * 60_000);

  return (
    <>
      <View className="flex-row gap-2.5">
        <SheetField label={t("createMatch.date")} className="flex-1">
          <DateField
            value={startsAt}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            accentColor={accent}
            onChange={(day) => onChange(withDay(startsAt, day))}
          />
        </SheetField>
        <SheetField
          label={t("createMatch.time")}
          detail={`· ${t("time.minutes", { count: MATCH_MINUTES })}`}
          className="flex-1"
        >
          <Dropdown
            label={t("createMatch.startTime")}
            placeholder="18:00"
            options={TIME_OPTIONS}
            value={TIME_OPTIONS.find((option) => option.value === clockTime(startsAt))}
            onChange={(option) => option && onChange(withTime(startsAt, option.value))}
            suffix={`– ${clockTime(endsAt)}`}
          />
        </SheetField>
      </View>

      {error || isInPast ? (
        <Text accessibilityRole="alert" className="-mt-1 font-semibold text-[13px] text-danger">
          {error ?? `${t("createMatch.timePassed")}. ${t("createMatch.pickLater")}`}
        </Text>
      ) : null}
    </>
  );
}

type DateFieldProps = {
  value: Date;
  minimumDate: Date;
  maximumDate: Date;
  accentColor: string;
  onChange: (date: Date) => void;
};

/**
 * Date field. iOS shows its compact picker inside the box. On Android the picker is a dialog
 * that opens the moment it is mounted, so it is only mounted while the player is choosing a date.
 */
function DateField({ value, minimumDate, maximumDate, accentColor, onChange }: DateFieldProps) {
  const [isPicking, setIsPicking] = useState(false);

  if (Platform.OS !== "android") {
    return (
      <PickerBox>
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          locale={dateLocale()}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={accentColor}
          themeVariant="light"
          onValueChange={(_, date) => onChange(date)}
          onChange={(_, date) => date && onChange(date)}
        />
      </PickerBox>
    );
  }

  return (
    <>
      <GesturePressable onPress={() => setIsPicking(true)} accessibilityRole="button">
        <PickerBox>
          <Icon as={CalendarDays} size={18} color="accent-text" />
          <Text className="font-semibold text-[15px] text-foreground">{formatMatchDay(value)}</Text>
        </PickerBox>
      </GesturePressable>
      {isPicking ? (
        <DateTimePicker
          value={value}
          mode="date"
          presentation="dialog"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={accentColor}
          onValueChange={(_, date) => {
            setIsPicking(false);
            onChange(date);
          }}
          onDismiss={() => setIsPicking(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Field box around the native date picker (or the button that opens it on Android).
 */
function PickerBox({ children }: { children: ReactNode }) {
  return (
    <View className="h-[52px] flex-row items-center gap-1.5 rounded-[14px] border border-line-input bg-surface px-2">
      {children}
    </View>
  );
}
