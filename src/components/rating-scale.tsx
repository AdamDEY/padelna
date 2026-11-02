import { cn, PressableFeedback } from "heroui-native";
import { ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, Equal, type LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { RATING_VALUES, type RatingValue } from "@/lib/player-rating";

const steps = {
  "-2": { label: "rating.wellBelow", icon: ChevronsDown },
  "-1": { label: "rating.bitBelow", icon: ChevronDown },
  "0": { label: "rating.asExpected", icon: Equal },
  "1": { label: "rating.bitAbove", icon: ChevronUp },
  "2": { label: "rating.wellAbove", icon: ChevronsUp },
} as const satisfies Record<`${RatingValue}`, { label: string; icon: LucideIcon }>;

type RatingScaleProps = {
  value?: RatingValue;
  onChange: (value: RatingValue) => void;
  /** Read out for the whole group, e.g. "How Mehdi played" */
  accessibilityLabel: string;
};

/**
 * Five tiles from "Well below" to "Well above" a player's profile level
 * (design: Post-match review · v2 five-point scale). Selected = solid primary.
 */
export function RatingScale({ value, onChange, accessibilityLabel }: RatingScaleProps) {
  const { t } = useTranslation();

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} className="flex-row gap-1.5">
      {RATING_VALUES.map((step) => {
        const isSelected = step === value;
        const { label, icon } = steps[`${step}`];
        return (
          <PressableFeedback
            key={step}
            onPress={() => onChange(step)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={t(label).replace("\n", " ")}
            className={cn(
              "h-[72px] flex-1 items-center justify-center gap-1 rounded-[14px] px-0.5",
              isSelected ? "bg-accent" : "border border-line-input bg-surface",
            )}
          >
            <Icon as={icon} size={20} color={isSelected ? "accent-foreground" : "foreground"} />
            <Text
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.9}
              className={cn(
                "text-center font-bold text-[11px] leading-[13px]",
                isSelected ? "text-accent-foreground" : "text-foreground",
              )}
            >
              {t(label)}
            </Text>
          </PressableFeedback>
        );
      })}
    </View>
  );
}
