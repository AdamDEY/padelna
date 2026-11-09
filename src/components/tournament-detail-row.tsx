import type { LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";

type TournamentDetailRowProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
};

/** One line under "Details": icon tile, small label, the value and an optional note. */
export function TournamentDetailRow({ icon, label, value, note }: TournamentDetailRowProps) {
  return (
    <View accessible className="flex-row items-start gap-3">
      <View className="size-10 items-center justify-center rounded-xl bg-background">
        <Icon as={icon} size={20} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-semibold text-[12px] text-muted">{label}</Text>
        <Text className="font-bold text-[15px] text-foreground">{value}</Text>
        {note ? <Text className="font-normal text-[13px] text-muted">{note}</Text> : null}
      </View>
    </View>
  );
}
