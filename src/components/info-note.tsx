import { cn } from "heroui-native";
import type { LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";

const tones = {
  // design.md "Info note": primary-soft fill
  info: { bg: "bg-primary-soft", fg: "text-primary-dark", icon: "primary-dark" },
  // design.md "Court not booked": sand note
  warning: { bg: "bg-warning-soft", fg: "text-warning", icon: "warning" },
} as const;

type InfoNoteProps = {
  icon: LucideIcon;
  /** Shown bold, first */
  title: string;
  children: string;
  tone?: keyof typeof tones;
};

/** Soft note with an icon; the first sentence is bold (design.md "Info note"). */
export function InfoNote({ icon, title, children, tone = "info" }: InfoNoteProps) {
  const colors = tones[tone];

  return (
    <View
      accessible
      accessibilityLabel={`${title} ${children}`}
      className={cn("flex-row gap-2.5 rounded-[18px] px-3.5 py-3", colors.bg)}
    >
      <View className="pt-0.5">
        <Icon as={icon} size={18} color={colors.icon} />
      </View>
      <Text className={cn("flex-1 font-normal text-[14px] leading-5", colors.fg)}>
        <Text className="font-bold">{title}</Text> {children}
      </Text>
    </View>
  );
}
