import { cn } from "heroui-native";
import { Trophy } from "lucide-react-native";
import type { ComponentRef, Ref } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PadelnaMark } from "@/components/padelna-logo";
import { PlayerAvatar } from "@/components/player-avatar";
import type { ShareResult } from "@/lib/tournament-share";

/** The image is laid out at the design's size, then captured at story resolution (9:16). */
export const TOURNAMENT_IMAGE_WIDTH = 390;
export const TOURNAMENT_IMAGE_HEIGHT = 694;
/** The blue card inside it, which the share sheet also shows as its preview */
export const TOURNAMENT_CARD_WIDTH = 350;
const FACE_SIZE = 28;
const FACE_OVERLAP = 10;
const BOX_SIZE = 32;

/** The blue result card: format, headline, the match or podium, and the numbers. */
export function TournamentShareCard({ result }: { result: ShareResult }) {
  const { t } = useTranslation();

  return (
    <View
      collapsable={false}
      className="gap-4 overflow-hidden rounded-[28px] bg-accent p-[22px]"
      style={{ width: TOURNAMENT_CARD_WIDTH }}
    >
      <View aria-hidden className="absolute -end-[50px] -top-[50px] size-[180px] rounded-full border-2 border-white/15" />

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <PadelnaMark size={26} />
          <Text className="font-black text-[15px] text-accent-foreground">Padelna</Text>
        </View>
        <View className="rounded-[9px] bg-white/15 px-[9px] py-1">
          <Text className="font-bold text-[11px] text-accent-foreground">{result.badge}</Text>
        </View>
      </View>

      <View className="items-center gap-2">
        <View className="size-16 items-center justify-center rounded-[20px] bg-lime">
          <Icon as={Trophy} size={34} color="lime-foreground" />
        </View>
        <Text className="text-center font-black text-[40px] leading-[42px] tracking-[-1px] text-lime">{result.headline}</Text>
        <Text className="text-center font-black text-[17px] text-accent-foreground">{result.name}</Text>
        <Text className="text-center font-normal text-[12px] text-primary-tint-text">{result.details}</Text>
      </View>

      {result.rows.length > 0 ? (
        <View className="gap-2.5 rounded-[20px] bg-surface p-3.5">
          <Text className="font-bold text-[11px] uppercase tracking-[0.6px] text-muted">{result.cardLabel}</Text>
          {result.rows.map((row, index) => (
            <View key={index} className="flex-row items-center gap-2.5">
              <View className="flex-row">
                {row.faces.map((player, faceIndex) => (
                  <View key={player.id} style={faceIndex > 0 ? { marginStart: -FACE_OVERLAP } : undefined}>
                    <PlayerAvatar player={player} size={FACE_SIZE} ringClassName="border-surface" />
                  </View>
                ))}
              </View>
              <Text
                numberOfLines={1}
                className={cn("flex-1 text-[14px]", row.isHighlighted ? "font-bold text-foreground" : "font-semibold text-ink-2")}
              >
                {row.name}
              </Text>
              {row.values.map((value, valueIndex) => (
                <View
                  key={valueIndex}
                  className={cn(
                    "items-center justify-center rounded-lg",
                    row.isHighlighted ? "bg-lime-soft" : "bg-background",
                  )}
                  style={{ width: BOX_SIZE, height: BOX_SIZE }}
                >
                  <Text className={cn("font-black text-[14px]", row.isHighlighted ? "text-lime-foreground" : "text-muted")}>
                    {value}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      <View className="flex-row rounded-2xl bg-white/12 py-2.5">
        {result.stats.map((stat, index) => (
          <View key={stat.label} className={cn("flex-1 items-center", index > 0 && "border-s border-white/20")}>
            <Text className="font-bold text-[17px] text-accent-foreground">{stat.value}</Text>
            <Text className="font-normal text-[11px] text-primary-tint-text">{stat.label}</Text>
          </View>
        ))}
      </View>

      <Text className="text-center font-normal text-[12px] text-primary-tint-text">{t("tournamentShare.image.footer")}</Text>
    </View>
  );
}

type TournamentShareImageProps = {
  result: ShareResult;
  /** The view to capture */
  ref?: Ref<ComponentRef<typeof View>>;
};

/**
 * The picture sent to chats and stories (design: "Tournament · result image for chats and stories").
 * It is never shown on screen: the share sheet draws it off-screen and saves it as a PNG.
 */
export function TournamentShareImage({ result, ref }: TournamentShareImageProps) {
  const { t } = useTranslation();

  return (
    <View
      ref={ref}
      collapsable={false}
      className="items-center justify-center gap-4 overflow-hidden bg-ink"
      style={{ width: TOURNAMENT_IMAGE_WIDTH, height: TOURNAMENT_IMAGE_HEIGHT }}
    >
      {/* Faint lime circles in two corners */}
      <View aria-hidden className="absolute -start-[90px] -bottom-[60px] size-[260px] rounded-full border-2 border-lime/20" />
      <View aria-hidden className="absolute -end-[70px] -top-[70px] size-[220px] rounded-full border-2 border-lime/15" />

      <TournamentShareCard result={result} />
      <Text className="font-normal text-[13px] text-ink-tint-text">{t("tournamentShare.image.site")}</Text>
    </View>
  );
}
