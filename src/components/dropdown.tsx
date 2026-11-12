import { cn, Select } from "heroui-native";
import { ChevronDown, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
// Gesture Handler's Pressable and ScrollView also receive touches inside bottom sheets
import {
  Pressable as GesturePressable,
  ScrollView as GestureScrollView,
} from "react-native-gesture-handler";

import { Icon } from "@/components/icon";

// Tallest a dropdown list gets before it scrolls
const LIST_MAX_HEIGHT = 360;

export type DropdownOption = { value: string; label: string };

/**
 * Dropdown field (HeroUI Select). The trigger is a Gesture Handler pressable
 * that opens the list itself, since Select's own trigger doesn't get taps
 * inside bottom sheets. Works the same on regular screens.
 */
export function Dropdown({
  label,
  icon,
  placeholder,
  options,
  value,
  onChange,
  isDisabled,
  suffix,
}: {
  label: string;
  icon?: LucideIcon;
  placeholder: string;
  options: DropdownOption[];
  value: DropdownOption | undefined;
  onChange: (option: DropdownOption | undefined) => void;
  isDisabled?: boolean;
  /** Muted text after the value, e.g. the end time */
  suffix?: string;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Select
      value={value}
      onValueChange={(option) => {
        onChange(option);
        setIsOpen(false);
      }}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      isDisabled={isDisabled}
      presentation="dialog"
    >
      <View className={cn("h-[52px]", isDisabled && "opacity-50")}>
        <GesturePressable
          onPress={() => setIsOpen(true)}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value?.label ?? t("dropdown.notChosen")}`}
          accessibilityHint={t("dropdown.hint")}
          style={{ flex: 1 }}
        >
          <View className="flex-1 flex-row items-center gap-2 rounded-[14px] border border-line-input bg-surface px-3">
            {icon ? <Icon as={icon} size={18} color="accent-text" /> : null}
            <Text
              numberOfLines={1}
              className={cn(
                "flex-1 font-semibold text-[15px]",
                value ? "text-foreground" : "text-muted",
              )}
            >
              {value?.label ?? placeholder}
              {suffix ? <Text className="text-muted"> {suffix}</Text> : null}
            </Text>
            <Icon as={ChevronDown} size={16} color="muted" />
          </View>
        </GesturePressable>
      </View>
      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="dialog">
          <Select.ListLabel className="mb-2">{label}</Select.ListLabel>
          {/* Long lists (half-hour times) scroll instead of running off the screen */}
          <GestureScrollView style={{ maxHeight: LIST_MAX_HEIGHT }} showsVerticalScrollIndicator>
            {options.map((option) => (
              <Select.Item key={option.value} value={option.value} label={option.label} />
            ))}
          </GestureScrollView>
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}
