import { BadgeCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Icon } from "@/components/icon";

type CoachVerifiedBadgeProps = {
  size?: number;
  /** Theme colour name; white-ish on the blue profile header */
  color?: string;
};

/** Check badge shown next to a level a coach has verified. */
export function CoachVerifiedBadge({ size = 18, color = "success" }: CoachVerifiedBadgeProps) {
  const { t } = useTranslation();
  return (
    <View accessible accessibilityLabel={t("coach.verifiedA11y")}>
      <Icon as={BadgeCheck} size={size} color={color} />
    </View>
  );
}
