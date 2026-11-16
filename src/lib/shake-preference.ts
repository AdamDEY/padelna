import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "padelna.shakeToReport";

// On until the player turns it off in Settings
let current = true;
const listeners = new Set<() => void>();

function apply(enabled: boolean) {
  current = enabled;
  listeners.forEach((listener) => listener());
}

/** Turns shake-to-report on or off and remembers the choice for the next launch. */
export async function setShakeToReport(enabled: boolean) {
  apply(enabled);
  await AsyncStorage.setItem(STORAGE_KEY, enabled ? "on" : "off").catch(() => {});
}

/** Applies the saved choice. Runs behind the splash screen. */
export async function restoreShakeToReport() {
  const saved = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  apply(saved !== "off");
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether shaking the phone opens the feedback sheet; re-renders when the player switches it. */
export function useShakeToReport() {
  return useSyncExternalStore(subscribe, () => current);
}
