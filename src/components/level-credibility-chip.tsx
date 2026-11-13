import { cn } from "heroui-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { LEVEL_CREDIBILITY, type LevelSource } from "@/data/level-credibility";

const tones = {
  // On a white sheet: blue for a level a quiz backs, sand (design.md "Starting level tag") for one picked without it
  light: {
    quiz: "bg-accent-soft text-accent-soft-foreground",
    self: "bg-warning-soft text-warning",
  },
  // On the blue profile header
  onBlue: {
    quiz: "bg-white/15 text-accent-foreground",
    self: "bg-white/15 text-accent-foreground",
  },
} as const;

type LevelCredibilityChipProps = {
  source: LevelSource;
  tone?: keyof typeof tones;
  /** How the level was set goes under the chip instead of inside it, for narrow places like the player sheet */
  isStacked?: boolean;
};

/** "50% credibility · Took the quiz" or "20% credibility · Skipped the quiz": how far a level can be trusted by how it was set. */
export function LevelCredibilityChip({ source, tone = "light", isStacked = false }: LevelCredibilityChipProps) {
  const { t } = useTranslation();
  const percent = LEVEL_CREDIBILITY[source];
  const how = t(`credibility.${source}`);
  const chipClass = cn(
    "self-start overflow-hidden rounded-[10px] px-2.5 py-1 font-bold text-[12px]",
    tones[tone][source],
  );

  if (isStacked) {
    return (
      <View
        accessible
        accessibilityLabel={t("credibility.a11y", { percent, how })}
        className="items-start gap-0.5"
      >
        <Text className={chipClass}>{t("credibility.percent", { percent })}</Text>
        <Text className="font-semibold text-[12px] text-muted">{how}</Text>
      </View>
    );
  }

  return (
    <Text accessible accessibilityLabel={t("credibility.a11y", { percent, how })} className={chipClass}>
      {t("credibility.percent", { percent })} · {how}
    </Text>
  );
}
