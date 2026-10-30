import { NativeTabs } from "expo-router/native-tabs";
import { useTranslation } from "react-i18next";
import { useCSSVariable } from "uniwind";

/**
 * Main tab bar. design.md asks for the native one, so on iOS 26 the system
 * draws it in Liquid Glass. Icons are SF Symbols on iOS, Material Symbols on Android.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const [accent, mutedIcon] = useCSSVariable(["--color-accent", "--color-muted-icon"]) as [
    string,
    string,
  ];

  return (
    <NativeTabs
      tintColor={accent}
      iconColor={{ default: mutedIcon, selected: accent }}
      labelStyle={{
        default: { color: mutedIcon, fontFamily: "Nunito_700Bold", fontSize: 11 },
        selected: { color: accent, fontFamily: "Nunito_800ExtraBold", fontSize: 11 },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t("tabs.home")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md={{ default: "home", selected: "home_filled" }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="matches">
        <NativeTabs.Trigger.Label>{t("tabs.matches")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "calendar", selected: "calendar" }}
          md="calendar_month"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="community">
        <NativeTabs.Trigger.Label>{t("tabs.community")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "photo", selected: "photo.fill" }} md="photo_library" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="players">
        <NativeTabs.Trigger.Label>{t("tabs.players")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person.2", selected: "person.2.fill" }} md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t("tabs.profile")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
          md="account_circle"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
