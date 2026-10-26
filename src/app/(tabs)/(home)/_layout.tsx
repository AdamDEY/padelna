import { Stack } from "expo-router";

/** Home tab: Home and the screens it opens that keep the tab bar (All clubs). */
export default function HomeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
