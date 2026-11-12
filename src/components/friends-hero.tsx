import { Button } from "heroui-native";
import { ChevronLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { PlayerAvatar, stackTintIndices } from "@/components/player-avatar";
import type { Player } from "@/types/player";

// The strip shows the first faces only
const MAX_FACES = 2;
// The blue avatar tint is the strip's own colour, so those faces would vanish
const BLUE_TINT = 0;

type FriendsHeroProps = {
  subtitle: string;
  /** Requests waiting for you; the strip is left out when there are none */
  requests: Player[];
  onBack: () => void;
  onReview: () => void;
};

/** Blue header of My friends: title, count and the connection requests strip (design canvas "My friends · from profile"). */
export function FriendsHero({ subtitle, requests, onBack, onReview }: FriendsHeroProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const faces = requests.slice(0, MAX_FACES);
  const tints = stackTintIndices(faces).reduce<number[]>((result, tint) => {
    const previous = result[result.length - 1];
    result.push(tint !== BLUE_TINT ? tint : previous === 1 ? 2 : 1);
    return result;
  }, []);

  return (
    <View
      className="gap-4 overflow-hidden rounded-b-[32px] bg-hero px-5 pb-5"
      style={{ paddingTop: insets.top + 8 }}
    >
      {/* Faint court lines in the corner */}
      <View
        aria-hidden
        className="absolute -end-[60px] h-[170px] w-[220px] rounded-lg border-2 border-white/10"
        style={{ top: insets.top + 30 }}
      />

      <View className="flex-row items-center gap-3">
        <Button
          variant="ghost"
          isIconOnly
          accessibilityLabel={t("common.back")}
          onPress={onBack}
          className="size-11 rounded-full bg-white/15"
        >
          <Icon as={ChevronLeft} size={22} color="accent-foreground" />
        </Button>
        <View className="flex-1">
          <Text
            accessibilityRole="header"
            className="font-black text-[22px] tracking-[-0.3px] text-accent-foreground"
          >
            {t("friends.title")}
          </Text>
          <Text className="font-normal text-[13px] text-primary-tint-text">{subtitle}</Text>
        </View>
      </View>

      {requests.length > 0 ? (
        <Pressable
          onPress={onReview}
          accessibilityRole="button"
          accessibilityLabel={`${t("connections.banner", { count: requests.length })}. ${t("connections.review")}`}
          className="flex-row items-center gap-2.5 rounded-2xl bg-white/14 py-2.5 pe-2.5 ps-3"
        >
          <View className="flex-row">
            {faces.map((player, index) => (
              <PlayerAvatar
                key={player.id}
                player={player}
                size={30}
                tintIndex={tints[index]}
                ringClassName="border-accent"
                className={index > 0 ? "-ms-2" : undefined}
              />
            ))}
          </View>
          <Text className="flex-1 font-bold text-[14px] text-accent-foreground">
            {t("connections.banner", { count: requests.length })}
          </Text>
          <Text className="overflow-hidden rounded-[11px] bg-lime px-3 py-[7px] font-black text-[13px] text-on-lime">
            {t("connections.review")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
