import "../global.css";

import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from "@expo-google-fonts/nunito";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Uniwind } from "uniwind";

import { CrashScreen } from "@/components/crash-screen";
import { PushNotificationObserver } from "@/components/push-notification-observer";
import { useAuthState } from "@/hooks/useAuthState";
import { restoreLanguage } from "@/i18n";
import { useMatchesRealtime } from "@/hooks/useMatchesRealtime";
import { useConnectionsRealtime } from "@/hooks/usePlayers";
import { usePrepareHome } from "@/hooks/usePrepareHome";
import { queryClient } from "@/lib/query-client";

// design.md only defines a light palette
Uniwind.setTheme("light");

SplashScreen.preventAutoHideAsync();

// A screen that crashes shows our own page instead of Expo Router's red developer one
export { CrashScreen as ErrorBoundary };

export default function RootLayout() {
  useMatchesRealtime();
  useConnectionsRealtime();
  // Home's data loads behind the splash screen, in parallel with the fonts
  const isHomeReady = usePrepareHome();
  const authState = useAuthState();
  // The saved language is applied behind the splash screen, so nothing flashes in the wrong one
  const [isLanguageReady, setIsLanguageReady] = useState(false);
  useEffect(() => {
    restoreLanguage().finally(() => setIsLanguageReady(true));
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  useEffect(() => {
    if ((fontsLoaded || fontError) && isHomeReady && isLanguageReady && authState !== "loading") {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isHomeReady, isLanguageReady, authState]);

  if ((!fontsLoaded && !fontError) || !isLanguageReady || authState === "loading") {
    return null;
  }

  const isSignedIn = authState !== "signedOut";
  const isReady = authState === "ready";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <HeroUINativeProvider>
          {/* Players only see the screens that fit where they are. A screen that stops being
              allowed (signing out, say) sends them to the first allowed one below. */}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={!isSignedIn}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Protected guard={isReady}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="match-history" />
              <Stack.Screen name="friends" />
              <Stack.Screen name="clubs" />
              <Stack.Screen name="club/[id]/index" />
              <Stack.Screen name="match/[id]/index" />
              <Stack.Screen name="match/[id]/rate" />
              <Stack.Screen name="match/[id]/chat" />
              <Stack.Screen name="design-check" />
            </Stack.Protected>
            <Stack.Protected guard={isSignedIn}>
              <Stack.Screen name="setup" />
              <Stack.Screen name="onboarding" />
            </Stack.Protected>
          </Stack>
          {/* Only for a player with a profile, so a tapped push always lands on an allowed screen */}
          {isReady ? <PushNotificationObserver /> : null}
        </HeroUINativeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
