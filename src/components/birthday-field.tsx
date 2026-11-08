import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { CalendarDays } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { latestBirthday } from "@/lib/age";
import { dateLocale, formatBirthday } from "@/lib/format-date";

const OLDEST_BIRTHDAY = new Date(1920, 0, 1);
// Where the wheel starts, so most players scroll a short way
const DEFAULT_BIRTHDAY = new Date(1995, 0, 1);

type BirthdayFieldProps = {
  value: Date | undefined;
  onChange: (date: Date) => void;
  placeholder: string;
  accessibilityLabel: string;
  isInvalid?: boolean;
};

/**
 * Birthday box. Empty until the player taps it, so nobody ends up with a birthday they never chose.
 * iOS then shows its compact picker in the box; Android opens a dialog.
 */
export function BirthdayField({ value, onChange, placeholder, accessibilityLabel, isInvalid }: BirthdayFieldProps) {
  const [isPicking, setIsPicking] = useState(false);
  const accent = String(useCSSVariable("--color-accent") ?? "");
  const maximumDate = latestBirthday();
  const boxClass = `h-[52px] flex-row items-center gap-2 rounded-[14px] border bg-surface px-3.5 ${
    isInvalid ? "border-danger" : "border-line-input"
  }`;

  if (value && Platform.OS !== "android") {
    return (
      <View className={boxClass}>
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          locale={dateLocale()}
          minimumDate={OLDEST_BIRTHDAY}
          maximumDate={maximumDate}
          accentColor={accent}
          themeVariant="light"
          onValueChange={(_, date) => onChange(date)}
          onChange={(_, date) => date && onChange(date)}
        />
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => {
          if (Platform.OS === "android") setIsPicking(true);
          else onChange(DEFAULT_BIRTHDAY > maximumDate ? maximumDate : DEFAULT_BIRTHDAY);
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className={boxClass}
      >
        <Icon as={CalendarDays} size={18} color="muted" />
        <Text className={value ? "font-semibold text-[16px] text-foreground" : "font-normal text-[16px] text-muted"}>
          {value ? formatBirthday(value) : placeholder}
        </Text>
      </Pressable>
      {isPicking ? (
        <DateTimePicker
          value={value ?? (DEFAULT_BIRTHDAY > maximumDate ? maximumDate : DEFAULT_BIRTHDAY)}
          mode="date"
          presentation="dialog"
          minimumDate={OLDEST_BIRTHDAY}
          maximumDate={maximumDate}
          accentColor={accent}
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
