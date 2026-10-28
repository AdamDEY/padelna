import { cn, PressableFeedback, Switch } from "heroui-native";
import { ChevronRight } from "lucide-react-native";
import { Children, Fragment, type ReactNode } from "react";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";

type SettingsSectionProps = {
  /** Uppercase label above the card; leave out for a bare card */
  title?: string;
  /** "list" draws rows edge to edge with dividers; "form" pads the card for fields */
  layout?: "list" | "form";
  children: ReactNode;
};

/** A titled white card on the settings page. */
export function SettingsSection({ title, layout = "list", children }: SettingsSectionProps) {
  const rows = Children.toArray(children);

  return (
    <View className="gap-2.5">
      {title ? (
        <Text
          accessibilityRole="header"
          className="font-bold text-[13px] uppercase tracking-[0.6px] text-muted"
        >
          {title}
        </Text>
      ) : null}
      <View
        className={cn(
          "overflow-hidden rounded-[20px] border border-line bg-surface",
          layout === "form" && "gap-3.5 p-3.5",
        )}
      >
        {layout === "list"
          ? rows.map((row, index) => (
              <Fragment key={index}>
                {index > 0 ? <View className="h-px bg-fill" /> : null}
                {row}
              </Fragment>
            ))
          : children}
      </View>
    </View>
  );
}

type SettingsRowProps = {
  label: string;
  /** Small caption above the label, e.g. "Phone" over the number */
  caption?: string;
  /** Muted value on the right, e.g. "English" */
  value?: string;
  onPress: () => void;
};

/** Tappable settings row with a chevron. */
export function SettingsRow({ label, caption, value, onPress }: SettingsRowProps) {
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[caption, label, value].filter(Boolean).join(", ")}
      className={cn("flex-row items-center gap-2.5 px-3.5", caption ? "min-h-14" : "min-h-[52px]")}
    >
      <View className="flex-1">
        {caption ? <Text className="font-normal text-[13px] text-muted">{caption}</Text> : null}
        <Text className="font-semibold text-[15px] text-foreground">{label}</Text>
      </View>
      {value ? <Text className="font-normal text-[14px] text-muted">{value}</Text> : null}
      <Icon as={ChevronRight} size={18} color="muted" />
    </PressableFeedback>
  );
}

type SettingsSwitchRowProps = {
  label: string;
  isSelected: boolean;
  onSelectedChange: (isSelected: boolean) => void;
};

/** Settings row with an on/off switch on the right. */
export function SettingsSwitchRow({ label, isSelected, onSelectedChange }: SettingsSwitchRowProps) {
  return (
    <View className="min-h-[52px] flex-row items-center gap-2.5 px-3.5">
      <Text className="flex-1 font-semibold text-[15px] text-foreground">{label}</Text>
      <Switch
        isSelected={isSelected}
        onSelectedChange={onSelectedChange}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** Field label inside a form card: smaller and quieter than a screen-level label. */
export function SettingsFieldLabel({ children }: { children: ReactNode }) {
  return <Text className="font-semibold text-[13px] text-ink-2">{children}</Text>;
}
