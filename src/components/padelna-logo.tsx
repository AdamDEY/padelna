import { Image } from "expo-image";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

/** Just the lime ball-seam mark, for headers on blue (the share card and its image). */
export function PadelnaMark({ size = 28 }: { size?: number }) {
  const ink = useCSSVariable("--color-foreground") as string;

  return (
    <View
      aria-hidden
      className="items-center justify-center rounded-full bg-lime"
      style={{ width: size, height: size }}
    >
      <Svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={1.8} strokeLinecap="round">
        <Circle cx={12} cy={12} r={9} />
        <Path d="M4.5 7.5c3 1.5 4.5 4 4.5 7.5M19.5 16.5c-3-1.5-4.5-4-4.5-7.5" />
      </Svg>
    </View>
  );
}

// Both are 1600 px wide, rendered from the brand SVGs ("LOGO Lime soft" and "LOGO Primary blue")
const logos = {
  lime: { source: require("../../assets/images/padelna-logo-lime.png"), aspect: 1600 / 906 },
  blue: { source: require("../../assets/images/padelna-logo-blue.png"), aspect: 1600 / 914 },
} as const;

type PadelnaLogoProps = {
  width?: number;
  /** Lime works on dark backgrounds, blue on light ones */
  tone?: keyof typeof logos;
};

/** The Padelna logo (design: Sign in · new logo): the ball-trail mark over the wordmark. */
export function PadelnaLogo({ width = 200, tone = "lime" }: PadelnaLogoProps) {
  const { source, aspect } = logos[tone];

  return (
    <Image
      source={source}
      accessibilityLabel="Padelna"
      contentFit="contain"
      style={{ width, aspectRatio: aspect }}
    />
  );
}
