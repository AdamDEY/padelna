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

import { CrashScreen } from "@/components/crash-screen";
import { Celebration } from "@/components/celebration";
import { PushNotificationObserver } from "@/components/push-notification-observer";
import { ShakeFeedback } from "@/components/shake-feedback";
import { useAuthState } from "@/hooks/useAuthState";
import { restoreLanguage } from "@/i18n";
import { useMatchesRealtime } from "@/hooks/useMatchesRealtime";
import { useNotificationsRealtime } from "@/hooks/useNotifications";
import { useConnectionsRealtime } from "@/hooks/usePlayers";
import { usePrepareHome } from "@/hooks/usePrepareHome";
import { queryClient } from "@/lib/query-client";
import { restoreShakeToReport } from "@/lib/shake-preference";
import { restoreThemePreference } from "@/lib/theme-preference";

SplashScreen.preventAutoHideAsync();

// A screen that crashes shows our own page instead of Expo Router's red developer one
export { CrashScreen as ErrorBoundary };

export default function RootLayout() {
  useMatchesRealtime();
  useConnectionsRealtime();
  useNotificationsRealtime();
  // Home's data loads behind the splash screen, in parallel with the fonts
  const isHomeReady = usePrepareHome();
  const authState = useAuthState();
  // The saved language and theme are applied behind the splash screen, so nothing flashes in the wrong one
  const [isLanguageReady, setIsLanguageReady] = useState(false);
  useEffect(() => {
    Promise.all([restoreLanguage(), restoreThemePreference(), restoreShakeToReport()]).finally(() => setIsLanguageReady(true));
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
              <Stack.Screen name="notifications" />
              <Stack.Screen name="match-history" />
              <Stack.Screen name="tournament-history/index" />
              <Stack.Screen name="tournament-history/[id]" />
              <Stack.Screen name="friends" />
              <Stack.Screen name="clubs" />
              <Stack.Screen name="club/[id]/index" />
              <Stack.Screen name="club/[id]/reviews" />
              <Stack.Screen name="match/[id]/index" />
              <Stack.Screen name="match/[id]/rate" />
              <Stack.Screen name="match/[id]/chat" />
              <Stack.Screen name="match/[id]/share" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="log-match" />
              <Stack.Screen name="tournaments" />
              <Stack.Screen name="tournament/[id]" />
              <Stack.Screen name="u/[code]" />
              <Stack.Screen name="design-check" />
            </Stack.Protected>
            <Stack.Protected guard={isSignedIn}>
              <Stack.Screen name="setup" />
              <Stack.Screen name="onboarding" />
            </Stack.Protected>
          </Stack>
          {/* Only for a player with a profile, so a tapped push always lands on an allowed screen */}
          {isReady ? <PushNotificationObserver /> : null}
          {/* Shake to send feedback; only for a player with a profile, since the sender is saved with it */}
          {isReady ? <ShakeFeedback /> : null}
          <Celebration />
        </HeroUINativeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
