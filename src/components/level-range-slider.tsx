import { Slider } from "heroui-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 7;

type LevelRangeSliderProps = {
  value: [number, number];
  onChange: (range: [number, number]) => void;
  /** Shown under the middle of the track as a reference */
  myLevel: number;
};

/** "Level range" slider with two thumbs in half-level steps, from Create match. */
export function LevelRangeSlider({ value, onChange, myLevel }: LevelRangeSliderProps) {
  const { t } = useTranslation();
  return (
    <Slider
      value={value}
      onChange={(next) => Array.isArray(next) && onChange([next[0], next[1]])}
      minValue={MIN_LEVEL}
      maxValue={MAX_LEVEL}
      step={0.5}
      className="gap-2"
    >
      <View className="flex-row items-baseline justify-between">
        <Text className="font-bold text-[14px] text-foreground">{t("createMatch.levelRange")}</Text>
        <Text className="font-black text-[15px] text-accent-text">
          {value[0].toFixed(1)} – {value[1].toFixed(1)}
        </Text>
      </View>
      <Slider.Track>
        {({ state }) => (
          <>
            <Slider.Fill />
            {state.values.map((_, i) => (
              <Slider.Thumb key={i} index={i} />
            ))}
          </>
        )}
      </Slider.Track>
      <View className="flex-row justify-between">
        <Text className="font-semibold text-[12px] text-muted">{MIN_LEVEL.toFixed(1)}</Text>
        <Text className="font-semibold text-[12px] text-muted">
          {t("level.yours", { level: myLevel.toFixed(1) })}
        </Text>
        <Text className="font-semibold text-[12px] text-muted">{MAX_LEVEL.toFixed(1)}</Text>
      </View>
    </Slider>
  );
}
