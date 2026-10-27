import { Button, cn } from "heroui-native";
import { ChevronLeft, SlidersHorizontal } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import type { PlayerProfile } from "@/types/profile";

const RING_SIZE = 104;
const RING_STROKE = 9;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2 - 3.5;

type ProfileHeroProps = {
  profile: PlayerProfile;
  onBack: () => void;
  onPressSettings?: () => void;
  onPressFriends?: () => void;
};

/** Blue profile header: who you are, your level ring with progress, and headline stats. */
export function ProfileHero({ profile, onBack, onPressSettings, onPressFriends }: ProfileHeroProps) {
  const insets = useSafeAreaInsets();
  const lime = useCSSVariable("--color-lime") as string;
  const nextLevel = profile.level + 0.5;
  const percent = Math.round(profile.progressToNext * 100);
  const circumference = 2 * Math.PI * RING_RADIUS;

  const stats = [
    { value: String(profile.matchesPlayed), label: "Played" },
    { value: `${profile.winRate}%`, label: "Win rate" },
    { value: profile.streak, label: "Streak" },
    { value: String(profile.friendCount), label: "Friends", onPress: onPressFriends },
  ];

  return (
    <View
      className="gap-[18px] overflow-hidden rounded-b-[32px] bg-accent px-5 pb-[22px]"
      style={{ paddingTop: insets.top + 8 }}
    >
      {/* Faint court lines in the corner */}
      <View
        aria-hidden
        className="absolute -end-[60px] h-[170px] w-[220px] rounded-lg border-2 border-white/10"
        style={{ top: insets.top + 60 }}
      />
      <View
        aria-hidden
        className="absolute end-[50px] h-[170px] w-0.5 bg-white/10"
        style={{ top: insets.top + 60 }}
      />

      <View className="flex-row items-center justify-between">
        <HeroIconButton icon="back" label="Back" onPress={onBack} />
        <HeroIconButton icon="settings" label="Edit profile and settings" onPress={onPressSettings} />
      </View>

      <View className="flex-row items-center gap-3">
        <PlayerAvatar player={profile.player} size={50} ringClassName="border-white/35" />
        <View className="flex-1">
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            className="font-black text-[21px] tracking-[-0.3px] text-accent-foreground"
          >
            {profile.player.firstName} {profile.player.lastName}
          </Text>
          <Text numberOfLines={1} className="font-normal text-[13px] text-primary-tint-text">
            {profile.city} · {profile.side} · {profile.playStyle}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-[18px]">
        <View
          accessible
          accessibilityLabel={`Level ${profile.level.toFixed(1)}, ${percent}% of the way to ${nextLevel.toFixed(1)}`}
          style={{ width: RING_SIZE, height: RING_SIZE }}
        >
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={RING_STROKE}
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={lime}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={`${circumference * profile.progressToNext} ${circumference}`}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
          <View className="absolute inset-0 items-center justify-center">
            <Text className="font-black text-[32px] leading-[34px] text-accent-foreground">
              {profile.level.toFixed(1)}
            </Text>
            <Text className="font-bold text-[11px] text-primary-tint-text">LEVEL</Text>
          </View>
        </View>

        <View className="flex-1 gap-1.5">
          <Text className="font-black text-[16px] text-accent-foreground">
            {percent}% of the way to {nextLevel.toFixed(1)}
          </Text>
          <Text className="font-normal text-[13px] leading-[18px] text-primary-tint-text">
            {profile.nextLevelHint}
          </Text>
          <Text className="self-start overflow-hidden rounded-[10px] bg-white/15 px-2.5 py-1 font-bold text-[12px] text-accent-foreground">
            Based on {profile.matchesPlayed} matches · {profile.reviewCount} reviews
          </Text>
        </View>
      </View>

      <View className="flex-row rounded-[18px] bg-white/10 py-3">
        {stats.map((stat, index) => (
          <Pressable
            key={stat.label}
            disabled={!stat.onPress}
            onPress={stat.onPress}
            accessibilityRole={stat.onPress ? "button" : undefined}
            accessibilityLabel={`${stat.value} ${stat.label}`}
            className={cn("flex-1 items-center", index > 0 && "border-s border-white/20")}
          >
            <Text className="font-black text-[19px] text-accent-foreground">{stat.value}</Text>
            <Text className="font-normal text-[11px] text-primary-tint-text">{stat.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Round translucent button for the blue header */
function HeroIconButton({
  icon,
  label,
  onPress,
}: {
  icon: "back" | "settings";
  label: string;
  onPress?: () => void;
}) {
  return (
    <Button
      variant="ghost"
      isIconOnly
      accessibilityLabel={label}
      onPress={onPress}
      className="size-11 rounded-full bg-white/15"
    >
      <Icon
        as={icon === "back" ? ChevronLeft : SlidersHorizontal}
        size={icon === "back" ? 22 : 20}
        color="accent-foreground"
      />
    </Button>
  );
}
