import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Appearance } from "react-native";
import { Uniwind } from "uniwind";

export type ThemePreference = "light" | "dark";

const STORAGE_KEY = "padelna.theme";
// Light until the player turns dark mode on; the phone's own setting is not followed
const DEFAULT_THEME: ThemePreference = "light";

let current: ThemePreference = DEFAULT_THEME;
const listeners = new Set<() => void>();

function isTheme(value: string | null | undefined): value is ThemePreference {
  return value === "light" || value === "dark";
}

function applyTheme(theme: ThemePreference) {
  current = theme;
  // Uniwind switches our colours; Appearance switches what iOS and Android draw themselves
  // (native tab bar, alerts, the keyboard, date pickers)
  Uniwind.setTheme(theme);
  Appearance.setColorScheme(theme);
  listeners.forEach((listener) => listener());
}

/** Switches the whole app at once and remembers the choice for the next launch. */
export async function setThemePreference(theme: ThemePreference) {
  applyTheme(theme);
  await AsyncStorage.setItem(STORAGE_KEY, theme).catch(() => {});
}

/** Applies the saved choice. Runs behind the splash screen so nothing flashes in the wrong theme. */
export async function restoreThemePreference() {
  const saved = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  applyTheme(isTheme(saved) ? saved : DEFAULT_THEME);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The theme the app is showing now, and it re-renders when the player switches. */
export function useThemePreference() {
  return useSyncExternalStore(subscribe, () => current);
}

/**
 * Status bar text over a plain page: dark text on the light theme, light text on the dark one.
 * Screens with a blue header use "light" over it and this one once it scrolls away.
 */
export function pageStatusBarStyle(): "light" | "dark" {
  return current === "dark" ? "light" : "dark";
}
