import { Bell, MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { IconButton } from "@/components/icon-button";
import { PlayerAvatar } from "@/components/player-avatar";
import type { Player } from "@/types/player";

type HomeHeaderProps = {
  /** Missing while your profile loads or if it can't load; the header keeps its size with a plain greeting */
  player?: Player;
  /** The player's level on the 1–7 scale */
  level?: number;
  city?: string;
  hasUnreadNotifications?: boolean;
  onPressNotifications?: () => void;
};

/** Home: your avatar with level badge, greeting with city, notifications. */
export function HomeHeader({
  player,
  level,
  city,
  hasUnreadNotifications,
  onPressNotifications,
}: HomeHeaderProps) {
  const { t } = useTranslation();
  const levelLabel = level?.toFixed(1);

  return (
    <View className="flex-row items-center gap-3">
      {/* Your own avatar: 2 px primary ring and a lime level badge (design.md).
          Your profile lives in its own tab, so the avatar isn't a button. */}
      {player && levelLabel ? (
        <View accessible accessibilityLabel={t("home.youLevel", { level: levelLabel })}>
          <PlayerAvatar player={player} size={44} ringClassName="border-accent" />
          <View className="absolute -bottom-1 -end-1.5 rounded-lg border-2 border-background bg-lime px-[5px] py-px">
            <Text className="font-black text-[10px] text-lime-foreground">{levelLabel}</Text>
          </View>
        </View>
      ) : (
        <View aria-hidden className="size-[48px] rounded-full bg-fill" />
      )}

      <View className="flex-1">
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          className="font-black text-[20px] tracking-[-0.3px] text-foreground"
        >
          {player ? t("home.greeting", { name: player.firstName }) : t("home.greetingFallback")}
        </Text>
        {city ? (
          <View className="flex-row items-center gap-1">
            <Icon as={MapPin} size={14} color="muted" />
            <Text className="font-normal text-[13px] text-muted">{city}</Text>
          </View>
        ) : null}
      </View>

      <IconButton
        icon={Bell}
        label={t("common.notifications")}
        showDot={hasUnreadNotifications}
        onPress={onPressNotifications}
      />
    </View>
  );
}
