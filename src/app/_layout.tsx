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
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Uniwind } from "uniwind";

import { useMatchesRealtime } from "@/hooks/useMatchesRealtime";
import { usePrepareHome } from "@/hooks/usePrepareHome";
import { queryClient } from "@/lib/query-client";

// design.md only defines a light palette
Uniwind.setTheme("light");

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useMatchesRealtime();
  // Home's data loads behind the splash screen, in parallel with the fonts
  const isHomeReady = usePrepareHome();

  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  useEffect(() => {
    if ((fontsLoaded || fontError) && isHomeReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isHomeReady]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <HeroUINativeProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </HeroUINativeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
