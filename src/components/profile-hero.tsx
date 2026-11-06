import { Button, cn } from "heroui-native";
import { SlidersHorizontal } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import type { PlayerProfile } from "@/types/profile";

const RING_SIZE = 104;
const RING_STROKE = 9;
// A dashed ring until there is a match to measure progress from
const RING_DASHES = "6 6";
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2 - 3.5;

const sideKeys = {
  left: "side.leftSide",
  right: "side.rightSide",
  both: "playerSheet.bothSides",
} as const;

type ProfileHeroProps = {
  profile: PlayerProfile;
  onPressSettings?: () => void;
  onPressFriends?: () => void;
  /** False until a first match is played: the stats and progress are left out */
  hasPlayed?: boolean;
  /** Real friend count; the profile's own is still mock */
  friendCount?: number;
};

/** Blue profile header: who you are, your level ring with progress, and headline stats. */
export function ProfileHero({ profile, onPressSettings, onPressFriends, hasPlayed = true, friendCount }: ProfileHeroProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const lime = useCSSVariable("--color-lime") as string;
  const nextLevel = profile.level + 0.5;
  const percent = Math.round(profile.progressToNext * 100);
  // "W3" = three wins in a row, "L2" = two losses
  const streak = t(profile.streak.startsWith("W") ? "profile.streakWin" : "profile.streakLoss", {
    count: Number(profile.streak.slice(1)),
  });
  const circumference = 2 * Math.PI * RING_RADIUS;

  const stats = [
    { value: String(profile.matchesPlayed), label: t("profile.played") },
    { value: `${profile.winRate}%`, label: t("profile.winRate") },
    { value: streak, label: t("profile.streak") },
    {
      value: String(friendCount ?? profile.friendCount),
      label: t("profile.friends"),
      onPress: onPressFriends,
    },
  ];
  // New players have no results yet, so only "Played" and "Friends" carry a number
  const shownStats = hasPlayed
    ? stats
    : [
        { ...stats[0], value: "0" },
        { ...stats[1], value: "–", dim: true },
        { ...stats[2], value: "–", dim: true },
        stats[3],
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
            {t("profile.heroLine", {
              city: profile.city,
              side: t(sideKeys[profile.side]),
              style: t(`playStyle.${profile.playStyle}`),
            })}
          </Text>
        </View>
        <HeroIconButton label={t("profile.editA11y")} onPress={onPressSettings} />
      </View>

      <View className="flex-row items-center gap-[18px]">
        <View
          accessible
          accessibilityLabel={t("profile.ringA11y", {
            level: profile.level.toFixed(1),
            percent,
            next: nextLevel.toFixed(1),
          })}
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
              strokeDasharray={hasPlayed ? undefined : RING_DASHES}
            />
            {hasPlayed ? (
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
            ) : null}
          </Svg>
          <View className="absolute inset-0 items-center justify-center">
            <Text className="font-black text-[32px] leading-[34px] text-accent-foreground">
              {profile.level.toFixed(1)}
            </Text>
            <Text className="font-bold text-[11px] text-primary-tint-text">{t("profile.levelWord")}</Text>
          </View>
        </View>

        {hasPlayed ? (
          <View className="flex-1 gap-1.5">
            <Text className="font-black text-[16px] text-accent-foreground">
              {t("profile.progress", { percent, next: nextLevel.toFixed(1) })}
            </Text>
            <Text className="font-normal text-[13px] leading-[18px] text-primary-tint-text">
              {t("profile.hint", {
                wins: profile.nextLevelHint.wins,
                level: profile.nextLevelHint.opponentLevel.toFixed(1),
              })}
            </Text>
            <Text className="self-start overflow-hidden rounded-[10px] bg-white/15 px-2.5 py-1 font-bold text-[12px] text-accent-foreground">
              {t("profile.basedOn", { matches: t("profile.matchesCount", { count: profile.matchesPlayed }) })}
            </Text>
          </View>
        ) : (
          <View className="flex-1 gap-1.5">
            <Text className="self-start overflow-hidden rounded-[10px] bg-lime px-2.5 py-1 font-bold text-[12px] text-lime-foreground">
              {t("profile.startingLevel")}
            </Text>
            <Text className="font-black text-[16px] text-accent-foreground">{t("profile.welcome")}</Text>
            <Text className="font-normal text-[13px] leading-[18px] text-primary-tint-text">
              {t("profile.welcomeHint")}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row rounded-[18px] bg-white/10 py-3">
        {shownStats.map((stat, index) => (
          <Pressable
            key={stat.label}
            disabled={!stat.onPress}
            onPress={stat.onPress}
            accessibilityRole={stat.onPress ? "button" : undefined}
            accessibilityLabel={`${stat.value} ${stat.label}`}
            className={cn("flex-1 items-center", index > 0 && "border-s border-white/20")}
          >
            <Text className={cn("font-black text-[19px] text-accent-foreground", "dim" in stat && "opacity-50")}>
              {stat.value}
            </Text>
            <Text className="font-normal text-[11px] text-primary-tint-text">{stat.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Round translucent settings button for the blue header */
function HeroIconButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Button
      variant="ghost"
      isIconOnly
      accessibilityLabel={label}
      onPress={onPress}
      className="size-11 rounded-full bg-white/15"
    >
      <Icon as={SlidersHorizontal} size={20} color="accent-foreground" />
    </Button>
  );
}
