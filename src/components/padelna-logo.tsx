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

// The artwork is 1600 × 906 px, drawn from the "LOGO Lime soft" SVG of the brand files
const LOGO_ASPECT = 1600 / 906;

/**
 * The Padelna logo (design: Sign in · new logo): the ball-trail mark over the wordmark, in lime,
 * so it only works on a dark background.
 */
export function PadelnaLogo({ width = 200 }: { width?: number }) {
  return (
    <Image
      source={require("../../assets/images/padelna-logo-lime.png")}
      accessibilityLabel="Padelna"
      contentFit="contain"
      style={{ width, aspectRatio: LOGO_ASPECT }}
    />
  );
}
