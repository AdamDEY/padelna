import { Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/icon";

type StarRatingProps = {
  /** 0 = not rated yet */
  value: number;
  onChange: (value: number) => void;
  /** What is being rated, for screen readers ("Court surface") */
  label: string;
};

const STARS = [1, 2, 3, 4, 5];

/**
 * Five tappable stars. Tapping the current value again clears it, so an
 * aspect can be left unrated. Each star has a 44 px touch target.
 */
export function StarRating({ value, onChange, label }: StarRatingProps) {
  const { t } = useTranslation();

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: value ? t("rateClub.starsOf", { value }) : t("rateClub.notRated") }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") onChange(Math.min(value + 1, 5));
        if (event.nativeEvent.actionName === "decrement") onChange(Math.max(value - 1, 0));
      }}
      className="flex-row"
    >
      {STARS.map((star) => (
        <Pressable
          key={star}
          onPress={() => onChange(star === value ? 0 : star)}
          // 22 px stars, 4 px apart, each with a full 44 px tap area
          hitSlop={{ top: 11, bottom: 11, left: 2, right: 2 }}
          className="px-0.5"
        >
          <Icon as={Star} size={22} color={star <= value ? "star" : "line-input"} filled />
        </Pressable>
      ))}
    </View>
  );
}
