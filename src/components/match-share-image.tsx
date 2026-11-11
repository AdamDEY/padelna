import { Image } from "expo-image";
import { cn } from "heroui-native";
import type { ComponentRef, ReactNode, Ref } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, Pattern, Polygon, Rect } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { PadelnaMark } from "@/components/padelna-logo";
import type { MatchShareData, ShareBackdrop, ShareStyle } from "@/lib/match-share";

// design (Share your match · exported story image): laid out at 390 × 694 (9:16) and captured
// at story size, 1080 × 1920 px
export const SHARE_IMAGE_WIDTH = 390;
export const SHARE_IMAGE_HEIGHT = 694;
// design: the overlay sits 26 px from the sides, 34 px from the bottom
const SIDE_MARGIN = 26;
const BOTTOM_MARGIN = 34;
// Instagram puts its own bar over the top of a story, so the top styles start below it
const TOP_MARGIN = 72;
// design: the score columns are 44 px wide
const SET_WIDTH = 44;
// A super tie-break as the deciding set (10–8) has two digits
const WIDE_SET_WIDTH = 62;
const SETS_FONT = 39;
// The darker band behind the Score style covers the bottom 42%, the other styles dim the whole photo
const SCRIM_HEIGHT = "42%";
const CHECKER_SIZE = 24;
const FORM_BOX = 36;

/** Where each style sits on the picture; the player can drag it up and down from there. */
export const shareAnchors = {
  score: "bottom",
  stats: "center",
  minimal: "top",
  streak: "top",
} as const satisfies Record<ShareStyle, "top" | "center" | "bottom">;

/** How far (in picture units) a style of the given height can be dragged up and down. */
export function shareDragRange(style: ShareStyle, contentHeight: number) {
  const anchor = shareAnchors[style];
  if (anchor === "bottom") return { min: -(SHARE_IMAGE_HEIGHT - BOTTOM_MARGIN - contentHeight), max: BOTTOM_MARGIN };
  if (anchor === "top") return { min: -TOP_MARGIN, max: SHARE_IMAGE_HEIGHT - TOP_MARGIN - contentHeight };
  const room = (SHARE_IMAGE_HEIGHT - contentHeight) / 2;
  return { min: -room, max: room };
}

function Logo({ size }: { size: number }) {
  return (
    <View className="flex-row items-center gap-2">
      <PadelnaMark size={size * 1.6} />
      <Text className="font-black text-white" style={{ fontSize: size }}>
        Padelna
      </Text>
    </View>
  );
}

/** The set scores as the design shows them: "6-4 3-6 7-5" */
function setsLine(data: MatchShareData, separator: string, pair: string) {
  return data.sets.map(([a, b]) => `${a}${pair}${b}`).join(separator);
}

/** The Score style: result chip, the two teams with their games per set, and where it was played. */
function ScoreStyle({ data }: { data: MatchShareData }) {
  const { t } = useTranslation();
  const won = data.result === "won";

  return (
    <View className="gap-[13px]">
      <Text
        className={cn(
          "self-start overflow-hidden rounded-[10px] px-[13px] py-[5px] font-black text-[16px] tracking-[1px]",
          won ? "bg-lime text-lime-foreground" : "bg-white/20 text-white",
        )}
      >
        {t(won ? "matchShare.chipWon" : "matchShare.chipLost", { count: data.setsWon, other: data.setsLost })}
      </Text>
      {[
        { names: data.myTeam, isMine: true },
        { names: data.theirTeam, isMine: false },
      ].map(({ names, isMine }) => (
        <View key={names} className={cn("flex-row items-center", !isMine && "opacity-80")}>
          <Text
            numberOfLines={1}
            className={cn("flex-1 text-[22px] text-white", isMine ? "font-black" : "font-bold")}
          >
            {names}
          </Text>
          {data.sets.map(([mine, theirs], index) => {
            const gamesWon = isMine ? mine > theirs : theirs > mine;
            return (
              <Text
                key={index}
                numberOfLines={1}
                className={cn("text-center font-black text-white", !gamesWon && "opacity-55")}
                // Both rows share a column, so a super tie-break like 10–8 widens it for both
                style={{ width: Math.max(mine, theirs) >= 10 ? WIDE_SET_WIDTH : SET_WIDTH, fontSize: SETS_FONT }}
              >
                {isMine ? mine : theirs}
              </Text>
            );
          })}
        </View>
      ))}
      <View className="mt-[5px] flex-row items-center justify-between gap-3">
        <Text numberOfLines={1} className="flex-1 font-bold text-[16px] text-white opacity-85">
          {data.place}
        </Text>
        <Logo size={18} />
      </View>
    </View>
  );
}

function StatsGroup({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center gap-0.5">
      <Text className="font-black text-[15px] uppercase tracking-[1px] text-white opacity-80">{label}</Text>
      <Text className="font-black text-[40px] tracking-[-0.8px] text-white">{value}</Text>
    </View>
  );
}

/** The Stats style: score, sets and a third number, centred. */
function StatsStyle({ data }: { data: MatchShareData }) {
  const { t } = useTranslation();
  const hasStreak = data.result === "won" && data.streak.count >= 2;
  const games = data.sets.reduce(([won, lost], [a, b]) => [won + a, lost + b], [0, 0]);

  return (
    <View className="items-center gap-6">
      <StatsGroup label={t("matchShare.score")} value={setsLine(data, " ", "-")} />
      <StatsGroup label={t("matchShare.sets")} value={`${data.setsWon} – ${data.setsLost}`} />
      {hasStreak ? (
        <StatsGroup label={t("matchShare.streak")} value={t("matchShare.winsCount", { count: data.streak.count })} />
      ) : (
        <StatsGroup label={t("matchShare.games")} value={`${games[0]} – ${games[1]}`} />
      )}
      <View className="mt-2">
        <Logo size={18} />
      </View>
    </View>
  );
}

/** The Minimal style: one big word and the sets under it. */
function MinimalStyle({ data }: { data: MatchShareData }) {
  const { t } = useTranslation();

  return (
    <View className="items-center gap-2">
      {/* A line height equal to the font size clips the tops of the capitals on iOS, so it is taller
          and the extra space is pulled back with negative margins */}
      <Text className="-my-3 font-black text-[96px] leading-[112px] tracking-[-4px] text-white">
        {t(data.result === "won" ? "matchShare.won" : "matchShare.lost")}
      </Text>
      <Text className="font-black text-[22px] text-white">{setsLine(data, " · ", "-")}</Text>
      <View className="mt-2">
        <Logo size={18} />
      </View>
    </View>
  );
}

/** The Streak style: the date, a headline about the run, and the last five results. */
function StreakStyle({ data }: { data: MatchShareData }) {
  const { t } = useTranslation();
  const isRun = data.result === "won" && data.streak.count >= 2;

  return (
    <View className="gap-[10px]">
      <Text className="font-black text-[15px] text-white opacity-85">{data.dateFirst}</Text>
      <Text className="font-black text-[58px] leading-[58px] tracking-[-1.5px] text-white">
        {isRun
          ? t("matchShare.winsInARow", { count: data.streak.count })
          : t(data.result === "won" ? "matchShare.wonScore" : "matchShare.lostScore", {
              won: data.setsWon,
              lost: data.setsLost,
            })}
      </Text>
      <View className="flex-row gap-1">
        {data.form.map((result, index) => (
          <View
            key={index}
            className={cn("items-center justify-center rounded-[7px]", result === "won" ? "bg-lime" : "bg-white/25")}
            style={{ width: FORM_BOX, height: FORM_BOX }}
          >
            <Text className={cn("font-black text-[15px]", result === "won" ? "text-lime-foreground" : "text-white")}>
              {t(result === "won" ? "matchShare.formWon" : "matchShare.formLost")}
            </Text>
          </View>
        ))}
      </View>
      <View className="mt-1">
        <Logo size={18} />
      </View>
    </View>
  );
}

/** The overlay itself, with no background: what the transparent sticker is made of. */
export function MatchShareContent({ data, style }: { data: MatchShareData; style: ShareStyle }) {
  if (style === "stats") return <StatsStyle data={data} />;
  if (style === "minimal") return <MinimalStyle data={data} />;
  if (style === "streak") return <StreakStyle data={data} />;
  return <ScoreStyle data={data} />;
}

/** Width of the Score style, which fills the picture between its margins */
const SCORE_WIDTH = SHARE_IMAGE_WIDTH - SIDE_MARGIN * 2;
const STICKER_PADDING = 16;

type MatchShareStickerProps = {
  data: MatchShareData;
  style: ShareStyle;
  /** The view to capture: just the overlay on a transparent background */
  ref?: Ref<ComponentRef<typeof View>>;
};

/** The transparent sticker (design: Share your match · transparent sticker). Drawn off-screen and captured as a PNG. */
export function MatchShareSticker({ data, style, ref }: MatchShareStickerProps) {
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        alignSelf: "flex-start",
        padding: STICKER_PADDING,
        width: style === "score" ? SCORE_WIDTH + STICKER_PADDING * 2 : undefined,
      }}
    >
      <MatchShareContent data={data} style={style} />
    </View>
  );
}

/** A tinted court drawing for when there's no photo yet (design: "Player photo placeholder"). */
function PhotoPlaceholder() {
  const ink = useCSSVariable("--color-foreground") as string;
  const court = useCSSVariable("--color-accent") as string;
  const ball = useCSSVariable("--color-lime") as string;
  // White court lines (the surface colour is white)
  const line = useCSSVariable("--color-surface") as string;

  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 300 534" preserveAspectRatio="xMidYMid slice">
      <Rect width={300} height={534} fill={ink} />
      <Polygon points="20,534 280,534 222,230 78,230" fill={court} />
      <Polygon points="20,534 280,534 222,230 78,230" fill="none" stroke={line} strokeOpacity={0.85} strokeWidth={3} />
      <Line x1={150} y1={230} x2={150} y2={534} stroke={line} strokeOpacity={0.85} strokeWidth={3} />
      <Line x1={49} y1={380} x2={251} y2={380} stroke={line} strokeOpacity={0.85} strokeWidth={3} />
      <Rect x={52} y={352} width={196} height={26} fill={ink} fillOpacity={0.55} />
      <Line x1={52} y1={352} x2={248} y2={352} stroke={line} strokeWidth={3} />
      <Circle cx={190} cy={300} r={7} fill={ball} />
    </Svg>
  );
}

/** The grey squares that say "this is transparent" behind the sticker preview. */
function Checkerboard() {
  const dark = useCSSVariable("--color-ink-2") as string;
  const light = useCSSVariable("--color-muted") as string;

  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <Pattern id="checker" patternUnits="userSpaceOnUse" width={CHECKER_SIZE * 2} height={CHECKER_SIZE * 2}>
          <Rect width={CHECKER_SIZE * 2} height={CHECKER_SIZE * 2} fill={dark} />
          <Rect width={CHECKER_SIZE} height={CHECKER_SIZE} fill={light} />
          <Rect x={CHECKER_SIZE} y={CHECKER_SIZE} width={CHECKER_SIZE} height={CHECKER_SIZE} fill={light} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#checker)" />
    </Svg>
  );
}

type MatchShareImageProps = {
  data: MatchShareData;
  style: ShareStyle;
  backdrop: ShareBackdrop;
  /** The photo behind the overlay; the court drawing shows without one */
  photoUri?: string;
  /** How far the player dragged the overlay from where its style puts it */
  offsetY?: number;
  /** Draw the grey squares behind a sticker, for the preview (the exported sticker has none) */
  showCheckerboard?: boolean;
  /** Called with the photo's address once it has loaded, so capturing waits for it */
  onPhotoLoad?: (uri: string) => void;
  /** Height of the overlay, so the preview knows how far it can be dragged */
  onContentHeight?: (height: number) => void;
  /** The view to capture */
  ref?: Ref<ComponentRef<typeof View>>;
};

/**
 * The share picture (design: Share your match · photo + overlay / exported story image): the
 * player's photo, a plain colour or nothing, with one of the four overlay styles on top.
 */
export function MatchShareImage({
  data,
  style,
  backdrop,
  photoUri,
  offsetY = 0,
  showCheckerboard,
  onPhotoLoad,
  onContentHeight,
  ref,
}: MatchShareImageProps) {
  const anchor = shareAnchors[style];
  const isPhoto = backdrop === "photo";

  return (
    <View
      ref={ref}
      collapsable={false}
      className={cn("overflow-hidden", backdrop === "plain" && "bg-accent")}
      style={{ width: SHARE_IMAGE_WIDTH, height: SHARE_IMAGE_HEIGHT }}
    >
      {isPhoto ? (
        photoUri ? (
          <Image
            source={{ uri: photoUri }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
            onLoad={() => onPhotoLoad?.(photoUri)}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <PhotoPlaceholder />
        )
      ) : null}
      {showCheckerboard && backdrop === "sticker" ? <Checkerboard /> : null}
      {isPhoto ? (
        style === "score" ? (
          <View aria-hidden className="absolute inset-x-0 bottom-0 bg-ink/60" style={{ height: SCRIM_HEIGHT }} />
        ) : (
          <View aria-hidden className="absolute inset-0 bg-ink/30" />
        )
      ) : null}

      <View
        className="absolute"
        style={{
          start: SIDE_MARGIN,
          end: SIDE_MARGIN,
          ...(anchor === "bottom" ? { bottom: BOTTOM_MARGIN } : null),
          ...(anchor === "top" ? { top: TOP_MARGIN } : null),
          ...(anchor === "center" ? { top: 0, bottom: 0, justifyContent: "center" } : null),
        }}
      >
        <View
          onLayout={(event) => onContentHeight?.(event.nativeEvent.layout.height)}
          style={{ transform: [{ translateY: offsetY }] }}
        >
          <MatchShareContent data={data} style={style} />
        </View>
      </View>
    </View>
  );
}

type ScaledShareProps = {
  scale: number;
  children: ReactNode;
};

/** Shows the full-size picture smaller, e.g. the preview and the style thumbnails. */
export function ScaledShare({ scale, children }: ScaledShareProps) {
  return (
    <View style={{ width: SHARE_IMAGE_WIDTH * scale, height: SHARE_IMAGE_HEIGHT * scale, overflow: "hidden" }}>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: SHARE_IMAGE_WIDTH,
          height: SHARE_IMAGE_HEIGHT,
          transform: [{ scale }],
          transformOrigin: "top left",
        }}
      >
        {children}
      </View>
    </View>
  );
}
