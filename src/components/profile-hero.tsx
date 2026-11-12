import { Button, cn } from "heroui-native";
import { QrCode, SlidersHorizontal, type LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { CoachVerifiedBadge } from "@/components/coach-verified-badge";
import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import type { PlayerProfile, ProfileStats } from "@/types/profile";

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
  /** Opens "Share your profile" with your QR code */
  onPressShare?: () => void;
  onPressFriends?: () => void;
  /** The player's results; their match count shows even before there are enough to show the rest */
  stats?: ProfileStats;
  /** False until enough matches have a confirmed score: the stats and progress are left out */
  hasPlayed?: boolean;
  /** Real friend count; the profile's own is still mock */
  friendCount?: number;
  /** A coach has verified the level shown (the profile's level is then the coach's) */
  isCoachVerified?: boolean;
};

/** Blue profile header: who you are, your level ring with progress, and headline stats. */
export function ProfileHero({ profile, onPressSettings, onPressShare, onPressFriends, stats, hasPlayed = true, friendCount, isCoachVerified = false }: ProfileHeroProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const lime = useCSSVariable("--color-lime") as string;
  const nextLevel = profile.nextLevel;
  const percent = Math.round(profile.progressToNext * 100);
  const streak = stats?.streak
    ? t(stats.streak.result === "won" ? "profile.streakWin" : "profile.streakLoss", { count: stats.streak.count })
    : "–";
  const circumference = 2 * Math.PI * RING_RADIUS;

  const statList = [
    { value: String(stats?.matchesPlayed ?? 0), label: t("profile.played") },
    { value: `${stats?.winRate ?? 0}%`, label: t("profile.winRate") },
    { value: streak, label: t("profile.streak") },
    {
      value: String(friendCount ?? 0),
      label: t("profile.friends"),
      onPress: onPressFriends,
    },
  ];
  // Until there are enough scored matches only "Played" and "Friends" carry a number
  const shownStats = hasPlayed
    ? statList
    : [statList[0], { ...statList[1], value: "–", dim: true }, { ...statList[2], value: "–", dim: true }, statList[3]];

  return (
    <View
      className="gap-[18px] overflow-hidden rounded-b-[32px] bg-hero px-5 pb-[22px]"
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
          {profile.gender && profile.age !== undefined ? (
            <Text numberOfLines={1} className="font-normal text-[13px] text-primary-tint-text">
              {t("profile.genderAge", { gender: t(`setup.${profile.gender}`), age: profile.age })}
            </Text>
          ) : null}
        </View>
        <HeroIconButton icon={QrCode} label={t("shareProfile.open")} onPress={onPressShare} />
        <HeroIconButton icon={SlidersHorizontal} label={t("profile.editA11y")} onPress={onPressSettings} />
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
            <View className="flex-row items-center gap-1">
              {isCoachVerified ? <CoachVerifiedBadge size={13} color="lime" /> : null}
              <Text className="font-bold text-[11px] text-primary-tint-text">{t("profile.levelWord")}</Text>
            </View>
          </View>
        </View>

        {hasPlayed ? (
          <View className="flex-1 gap-1.5">
            <Text className="font-black text-[16px] text-accent-foreground">
              {t("profile.progress", { percent, next: nextLevel.toFixed(1) })}
            </Text>
            {isCoachVerified ? (
              <Text className="self-start overflow-hidden rounded-[10px] bg-lime px-2.5 py-1 font-bold text-[12px] text-on-lime">
                {t("coach.verified")}
              </Text>
            ) : null}
            <Text className="self-start overflow-hidden rounded-[10px] bg-white/15 px-2.5 py-1 font-bold text-[12px] text-accent-foreground">
              {t("profile.basedOn", { matches: t("profile.matchesCount", { count: stats?.matchesScored ?? 0 }) })}
            </Text>
          </View>
        ) : (
          <View className="flex-1 gap-1.5">
            <Text className="self-start overflow-hidden rounded-[10px] bg-lime px-2.5 py-1 font-bold text-[12px] text-on-lime">
              {isCoachVerified ? t("coach.verified") : t("profile.startingLevel")}
            </Text>
            <Text className="font-black text-[16px] text-accent-foreground">
              {isCoachVerified ? t("coach.heroTitle") : t("profile.welcome")}
            </Text>
            <Text className="font-normal text-[13px] leading-[18px] text-primary-tint-text">
              {isCoachVerified ? t("coach.heroHint") : t("profile.welcomeHint")}
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

/** Round translucent button for the blue header */
function HeroIconButton({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress?: () => void }) {
  return (
    <Button
      variant="ghost"
      isIconOnly
      accessibilityLabel={label}
      onPress={onPress}
      className="size-11 rounded-full bg-white/15"
    >
      <Icon as={icon} size={20} color="accent-foreground" />
    </Button>
  );
}
