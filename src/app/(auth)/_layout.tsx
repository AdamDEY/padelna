import { Stack } from "expo-router";

/** Sign in and sign up: their own stack, without the tab bar. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
