import { Button } from "heroui-native";
import { Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import type { Player } from "@/types/player";

const SLOT_SIZE = 34;
// How far the four player spots sit from the court's left and right edges
const SLOT_INSET = 62;

type OpenMatchesEmptyCardProps = {
  player?: Player;
  /** The player's level, quoted in the text */
  level: number;
  onCreate: () => void;
};

/** Open spot on the court drawing (design.md "Empty slot") */
function Slot({ className, top }: { className: string; top: number }) {
  return (
    <View
      className={`absolute rounded-full border-2 border-dashed border-slot-border bg-white/60 ${className}`}
      style={{ top, width: SLOT_SIZE, height: SLOT_SIZE }}
    />
  );
}

/** Home's card when no open match suits the player (design canvas "Home · empty v2"). */
export function OpenMatchesEmptyCard({ player, level, onCreate }: OpenMatchesEmptyCardProps) {
  const { t } = useTranslation();
  const initials = player ? `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`.toUpperCase() : "";

  return (
    <View className="gap-3.5 rounded-[24px] border border-line bg-surface px-3 pb-4 pt-3">
      <View aria-hidden className="h-[118px] overflow-hidden rounded-[18px] bg-primary-soft">
        {/* Court seen from above: outline, net and service line */}
        <View className="absolute inset-x-7 inset-y-4 rounded border-2 border-white" />
        <View className="absolute inset-y-4 left-1/2 w-[3px] bg-white" />
        <View className="absolute inset-x-7 top-1/2 h-0.5 bg-white/70" />

        <View
          className="absolute items-center justify-center rounded-full border-[3px] border-white bg-accent"
          style={{ top: 22, start: SLOT_INSET, width: SLOT_SIZE, height: SLOT_SIZE }}
        >
          <Text className="font-black text-[11px] text-accent-foreground">{initials}</Text>
        </View>
        <Slot className="start-[62px]" top={62} />
        <Slot className="end-[62px]" top={22} />
        <Slot className="end-[62px]" top={62} />
        <View className="absolute left-[54%] top-[46px] size-3 rounded-full bg-lime" />
      </View>

      <View className="gap-1 px-1">
        <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
          {t("home.noOpenMatchesTitle")}
        </Text>
        <Text className="font-normal text-[13px] leading-[18px] text-muted">
          {t("home.noOpenMatchesBody", { level: level.toFixed(1) })}
        </Text>
      </View>

      <Button onPress={onCreate} className="mx-1 h-12 rounded-[14px]">
        <Icon as={Plus} size={18} color="accent-foreground" />
        <Button.Label className="text-[16px]">{t("home.createMatchAction")}</Button.Label>
      </Button>
    </View>
  );
}
