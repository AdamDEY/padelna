import { PressableFeedback } from "heroui-native";
import { Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";

// design.md: the button floats 16 px above the tab bar
const GAP_ABOVE_TAB_BAR = 16;

/**
 * Floating lime "Create match" pill, bottom right on Home (design.md: only
 * floating elements get a shadow).
 */
export function CreateMatchButton({ onPress }: { onPress: () => void }) {
  // Inside a native tab the bottom inset already includes the tab bar's height
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("home.createMatchA11y")}
      className="absolute end-5 h-14 flex-row items-center gap-2 rounded-full bg-lime pe-[22px] ps-[18px]"
      style={{
        bottom: insets.bottom + GAP_ABOVE_TAB_BAR,
        shadowColor: "#17202B",
        shadowOpacity: 0.16,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      }}
    >
      <Icon as={Plus} size={22} />
      <Text className="font-black text-[16px] text-foreground">{t("home.createMatch")}</Text>
    </PressableFeedback>
  );
}
