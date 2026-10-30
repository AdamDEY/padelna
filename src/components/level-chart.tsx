import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Polygon, Polyline } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { translateLabel } from "@/i18n";

const CHART_HEIGHT = 84;
// Room around the line so the end dot isn't clipped
const PADDING = 10;
const DOT_RADIUS = 6;

type LevelChartProps = {
  /** Level at the end of each month, oldest first */
  points: { month: string; level: number }[];
};

/** Area chart of your level over recent months, with month labels below. */
export function LevelChart({ points }: LevelChartProps) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const [accent, soft, grid, surface] = useCSSVariable([
    "--color-accent",
    "--color-primary-soft",
    "--color-out-of-range",
    "--color-surface",
  ]) as string[];

  const levels = points.map((point) => point.level);
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  const span = max - min || 1;

  const coords = points.map((point, index) => {
    // Inset by the dot's size so the last point stays fully visible
    const usable = width - DOT_RADIUS * 2 - 2;
    const x = DOT_RADIUS + 1 + (points.length > 1 ? (index / (points.length - 1)) * usable : usable / 2);
    const y = PADDING + (1 - (point.level - min) / span) * (CHART_HEIGHT - PADDING * 2);
    return { x, y };
  });
  const line = coords.map(({ x, y }) => `${x},${y}`).join(" ");
  const area = `${coords[0]?.x ?? 0},${CHART_HEIGHT} ${line} ${coords[coords.length - 1]?.x ?? width},${CHART_HEIGHT}`;
  const last = coords[coords.length - 1];
  const first = points[0];
  const latest = points[points.length - 1];

  return (
    <View
      accessible
      accessibilityLabel={t("profile.levelA11y", {
        from: first?.level.toFixed(1),
        fromMonth: first && translateLabel("months", first.month),
        to: latest?.level.toFixed(1),
        toMonth: latest && translateLabel("months", latest.month),
      })}
      className="gap-2"
    >
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: CHART_HEIGHT }}>
        {width > 0 && last ? (
          <Svg width={width} height={CHART_HEIGHT} style={{ overflow: "visible" }}>
            <Line x1={0} y1={PADDING} x2={width} y2={PADDING} stroke={grid} strokeDasharray="3 4" />
            <Line
              x1={0}
              y1={CHART_HEIGHT - PADDING}
              x2={width}
              y2={CHART_HEIGHT - PADDING}
              stroke={grid}
              strokeDasharray="3 4"
            />
            <Polygon points={area} fill={soft} />
            <Polyline
              points={line}
              fill="none"
              stroke={accent}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <Circle
              cx={last.x}
              cy={last.y}
              r={DOT_RADIUS}
              fill={accent}
              stroke={surface}
              strokeWidth={3}
            />
          </Svg>
        ) : null}
      </View>
      <View className="flex-row justify-between">
        {points.map((point) => (
          <Text key={point.month} className="font-normal text-[12px] text-muted">
            {translateLabel("months", point.month)}
          </Text>
        ))}
      </View>
    </View>
  );
}
