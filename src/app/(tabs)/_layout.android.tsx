import { Tabs } from "expo-router/js-tabs";
import { CalendarDays, CircleUserRound, House, Image, Users, type LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

import { FloatingTabBar, TAB_BAR_HEIGHT, tabBarBottom } from "@/components/floating-tab-bar";
import { Icon } from "@/components/icon";

function tabIcon(icon: LucideIcon) {
  function TabIcon({ focused }: { focused: boolean }) {
    return <Icon as={icon} color={focused ? "accent-text" : "muted-icon"} />;
  }
  return TabIcon;
}

/**
 * Main tab bar on Android. The native one is Material there, so we draw the
 * floating bar from design.md instead; iOS keeps NativeTabs (_layout.tsx).
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // The bar floats over the screens. Like a native tab on iOS, their bottom
  // inset includes it, so Page and the Create match button clear it unchanged.
  const screenInsets = { ...insets, bottom: tabBarBottom(insets.bottom) + TAB_BAR_HEIGHT };

  return (
    <SafeAreaInsetsContext.Provider value={screenInsets}>
      <Tabs
        // The bar itself needs the real system inset, not the one given to screens
        safeAreaInsets={insets}
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{ headerShown: false, animation: "fade" }}
      >
        <Tabs.Screen name="index" options={{ title: t("tabs.home"), tabBarIcon: tabIcon(House) }} />
        <Tabs.Screen
          name="matches"
          options={{ title: t("tabs.matches"), tabBarIcon: tabIcon(CalendarDays) }}
        />
        <Tabs.Screen
          name="community"
          options={{ title: t("tabs.community"), tabBarIcon: tabIcon(Image) }}
        />
        <Tabs.Screen name="players" options={{ title: t("tabs.players"), tabBarIcon: tabIcon(Users) }} />
        <Tabs.Screen
          name="profile"
          options={{ title: t("tabs.profile"), tabBarIcon: tabIcon(CircleUserRound) }}
        />
      </Tabs>
    </SafeAreaInsetsContext.Provider>
  );
}
