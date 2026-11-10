import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useRef } from "react";
import type { LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * White status bar text while a blue header is behind it, dark once it scrolls away (Match history,
 * Tournament history and its recaps). Put `onHeroLayout` on the view around the header and
 * `onScrollY` on `Page.Body`.
 */
export function useHeroStatusBar() {
  const insets = useSafeAreaInsets();
  const heroHeight = useRef(0);
  const isOverHero = useRef(true);

  const apply = useCallback(() => {
    setStatusBarStyle(isOverHero.current ? "light" : "dark");
  }, []);

  useFocusEffect(
    useCallback(() => {
      apply();
      return () => setStatusBarStyle("dark");
    }, [apply]),
  );

  return {
    onHeroLayout: (event: LayoutChangeEvent) => {
      heroHeight.current = event.nativeEvent.layout.height;
    },
    onScrollY: (y: number) => {
      const over = y < heroHeight.current - insets.top;
      if (over !== isOverHero.current) {
        isOverHero.current = over;
        apply();
      }
    },
  };
}
