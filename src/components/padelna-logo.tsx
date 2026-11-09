import { Text, View } from "react-native";
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

/** design.md logo: lime circle with a ball-seam mark and the "Padelna" wordmark. */
export function PadelnaLogo() {
  const ink = useCSSVariable("--color-foreground") as string;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Padelna" className="flex-row items-center gap-2.5">
      <View className="size-10 items-center justify-center rounded-full bg-lime">
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth={1.8} strokeLinecap="round">
          <Circle cx={12} cy={12} r={9} />
          <Path d="M4.5 7.5c3 1.5 4.5 4 4.5 7.5M19.5 16.5c-3-1.5-4.5-4-4.5-7.5" />
        </Svg>
      </View>
      <Text className="font-black text-[20px] tracking-[-0.3px] text-foreground">Padelna</Text>
    </View>
  );
}
