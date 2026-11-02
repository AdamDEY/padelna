import { cn, Select } from "heroui-native";
import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";

import { Icon } from "@/components/icon";
import type { DropdownOption } from "@/components/dropdown";

type FilterDropdownProps = {
  /** Names the list, e.g. "Club" */
  label: string;
  /** Text on the pill when nothing is picked, e.g. "Any club"; also the first option */
  anyLabel: string;
  options: DropdownOption[];
  /** The picked option's value; undefined = any */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
};

/** Small pill that opens a list of choices (design canvas "Any club ▾"). */
export function FilterDropdown({ label, anyLabel, options, value, onChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const picked = options.find((option) => option.value === value);

  return (
    <Select
      value={picked}
      onValueChange={(option) => {
        onChange(option?.value === ANY ? undefined : option?.value);
        setIsOpen(false);
      }}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      presentation="dialog"
    >
      <Pressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${picked?.label ?? anyLabel}`}
        hitSlop={4}
        className={cn(
          "h-[34px] flex-row items-center gap-1 rounded-full border px-3",
          picked ? "border-transparent bg-primary-soft" : "border-line-input bg-surface",
        )}
      >
        <Text className={cn("text-[13px]", picked ? "font-bold text-primary-dark" : "font-semibold text-foreground")}>
          {picked?.label ?? anyLabel}
        </Text>
        <Icon as={ChevronDown} size={14} color={picked ? "primary-dark" : "foreground"} />
      </Pressable>
      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="dialog">
          <Select.ListLabel className="mb-2">{label}</Select.ListLabel>
          <Select.Item value={ANY} label={anyLabel} />
          {options.map((option) => (
            <Select.Item key={option.value} value={option.value} label={option.label} />
          ))}
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}

// Stands for "any" in the list, since Select needs a value for every row
const ANY = "__any__";
