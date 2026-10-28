import { cn } from "heroui-native";
import { Ban, Check, ShieldCheck, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import type { Player } from "@/types/player";

// Illustration players, so the pictures don't change when the mock data does
const amira: Player = { id: "ob-amira", firstName: "Amira", lastName: "Kefi" };
const mehdi: Player = { id: "ob-mehdi", firstName: "Mehdi", lastName: "Trabelsi" };
const salma: Player = { id: "ob-salma", firstName: "Salma", lastName: "Haddad" };
const youssef: Player = { id: "ob-youssef", firstName: "Youssef", lastName: "Ben Ali" };

// Avatar tints by index, as in the design: blue, peach, mint, lilac
const TINT = { blue: 0, peach: 1, mint: 2, lilac: 3 } as const;

/** Soft drop shadow for the cards floating on an illustration. */
function useFloatingShadow(): ViewStyle {
  const ink = useCSSVariable("--color-ink");
  return {
    shadowColor: typeof ink === "string" ? ink : undefined,
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  };
}

/** Tinted, rounded block that holds each onboarding picture (design.md "Hero / illustration blocks"). */
function IllustrationFrame({ className, children }: { className: string; children: ReactNode }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn("flex-1 items-center justify-center overflow-hidden rounded-[32px]", className)}
    >
      {children}
    </View>
  );
}

/** 1 · Find players: player cards scattered over a court. */
export function FindPlayersIllustration() {
  const shadow = useFloatingShadow();
  const cards = [
    { player: amira, tint: TINT.peach, meta: "Right side · Lac", level: "4.0", style: { start: 34, top: 64 } },
    { player: mehdi, tint: TINT.mint, meta: "Left side · Gammarth", level: "4.5", style: { end: 30, top: 158 } },
    { player: salma, tint: TINT.lilac, meta: "Both sides · Marsa", level: "4.0", style: { start: 50, top: 252 } },
  ];

  return (
    <IllustrationFrame className="bg-court-blue">
      <View className="absolute inset-10 rounded-md border-2 border-white/80" />
      <View className="absolute inset-x-10 top-1/2 h-[3px] bg-white/90" />
      {cards.map((card) => (
        <View
          key={card.player.id}
          // At least the design's 210 px, wider when the text needs it
          className="absolute min-w-[210px] flex-row items-center gap-2.5 rounded-[18px] bg-surface p-3"
          style={[card.style, shadow]}
        >
          <PlayerAvatar player={card.player} size={42} tintIndex={card.tint} />
          <View className="gap-0.5">
            <Text className="font-bold text-[15px] text-foreground">
              {card.player.firstName} {card.player.lastName[0]}.
            </Text>
            <Text className="font-normal text-[12px] text-muted">{card.meta}</Text>
          </View>
          <Text className="ms-auto overflow-hidden rounded-[10px] bg-lime-soft px-2 py-1 font-bold text-[12px] text-lime-foreground">
            {card.level}
          </Text>
        </View>
      ))}
    </IllustrationFrame>
  );
}

/** 2 · Trusted level: a level card shaped by reviews, with reputation tags. */
export function TrustedLevelIllustration() {
  const shadow = useFloatingShadow();
  const tags = ["Fair play · 12", "Great teammate · 9", "On time · 11"];

  return (
    <IllustrationFrame className="gap-3.5 bg-court-lime">
      <View className="w-[250px] items-center gap-2 rounded-[22px] bg-surface p-5" style={shadow}>
        <PlayerAvatar player={youssef} size={64} tintIndex={TINT.blue} />
        <Text className="font-semibold text-[13px] text-muted">Level after 14 reviews</Text>
        <View className="flex-row items-center gap-2">
          <Text className="font-black text-[44px] leading-[46px] tracking-[-1px] text-foreground">
            4.5
          </Text>
          <Text className="overflow-hidden rounded-xl bg-success-soft px-2.5 py-1 font-bold text-[13px] text-success">
            ▲ 0.5
          </Text>
        </View>
      </View>
      <View className="w-[300px] flex-row flex-wrap justify-center gap-2">
        {tags.map((tag) => (
          <Text
            key={tag}
            className="overflow-hidden rounded-[14px] bg-surface px-3 py-2 font-bold text-[13px] text-foreground"
          >
            {tag}
          </Text>
        ))}
      </View>
    </IllustrationFrame>
  );
}

/** 3 · Fair play: a shield over the house rules. */
export function FairPlayIllustration() {
  const shadow = useFloatingShadow();
  const rules: { label: string; icon: LucideIcon; negative?: boolean }[] = [
    { label: "Honest scores", icon: Check },
    { label: "Honest ratings", icon: Check },
    { label: "Sabotage = banned", icon: Ban, negative: true },
  ];

  return (
    <IllustrationFrame className="gap-[18px] bg-avatar-lilac">
      <View className="size-[84px] items-center justify-center rounded-full bg-surface" style={shadow}>
        <Icon as={ShieldCheck} size={44} color="avatar-lilac-foreground" />
      </View>
      <View className="w-[270px] gap-2">
        {rules.map((rule) => (
          <View
            key={rule.label}
            className={cn(
              "flex-row items-center gap-2.5 rounded-[14px] px-3.5 py-2.5",
              rule.negative ? "bg-attention-soft" : "bg-surface",
            )}
          >
            <Icon as={rule.icon} size={18} color={rule.negative ? "attention" : "success"} />
            <Text
              className={cn(
                "font-bold text-[14px]",
                rule.negative ? "text-attention" : "text-foreground",
              )}
            >
              {rule.label}
            </Text>
          </View>
        ))}
      </View>
    </IllustrationFrame>
  );
}

/** 4 · Community: a shared match result, like a feed post. */
export function CommunityIllustration() {
  const shadow = useFloatingShadow();
  const players = [
    { player: youssef, tint: TINT.blue },
    { player: amira, tint: TINT.peach },
    { player: mehdi, tint: TINT.mint },
    { player: salma, tint: TINT.lilac },
  ];

  return (
    <IllustrationFrame className="bg-court-peach">
      <View className="w-[270px] gap-3 rounded-[22px] bg-surface p-3.5" style={shadow}>
        <View className="flex-row items-center gap-2.5">
          <View className="flex-row">
            {players.map(({ player, tint }, index) => (
              <PlayerAvatar
                key={player.id}
                player={player}
                size={26}
                tintIndex={tint}
                ringClassName="border-surface"
                className={index > 0 ? "-ms-2.5" : undefined}
              />
            ))}
          </View>
          <View>
            <Text className="font-bold text-[13px] text-foreground">Sunday match</Text>
            <Text className="font-normal text-[11px] text-muted">Lac Padel Arena · 2h</Text>
          </View>
        </View>
        <View className="h-[120px] overflow-hidden rounded-[14px] bg-court-blue">
          <View className="absolute inset-x-6 inset-y-4 rounded border-2 border-white/85" />
          <View className="absolute inset-y-4 left-1/2 w-[3px] bg-white/90" />
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="font-black text-[20px] tracking-[-0.3px] text-foreground">6–4 · 7–5</Text>
          <Text className="overflow-hidden rounded-[10px] bg-lime-soft px-2.5 py-1 font-bold text-[12px] text-lime-foreground">
            Won
          </Text>
        </View>
      </View>
    </IllustrationFrame>
  );
}
