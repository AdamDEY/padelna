import { useMutation, useQuery } from "@tanstack/react-query";
import i18n from "i18next";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { getExpoPushToken, getPushPermission, requestPushPermission } from "@/lib/push-notifications";
import { queryClient } from "@/lib/query-client";
import {
  fetchNotificationSettings,
  registerPushToken,
  saveNotificationSettings,
  unregisterPushToken,
  type NotificationSettings,
} from "@/repositories/notification-repository";

const permissionKey = ["push-permission"] as const;
const settingsKey = ["notification-settings"] as const;

// The token this phone saved, so signing out can remove it
let registeredToken: string | undefined;

/** Saves this phone's push token for the signed-in player, if pushes are allowed. */
export async function registerThisPhone() {
  if ((await getPushPermission()) !== "granted") return;
  const token = await getExpoPushToken();
  await registerPushToken(token, Platform.OS === "android" ? "android" : "ios", i18n.language);
  registeredToken = token;
}

/**
 * Asks for push permission the first time it matters (joining or creating a match, or the
 * switch in Edit profile). Does nothing if the player already answered.
 */
export async function askForPushNotifications() {
  try {
    const permission = await requestPushPermission();
    queryClient.setQueryData(permissionKey, permission);
    if (permission === "granted") await registerThisPhone();
  } catch (error) {
    // Pushes are a nice extra; failing to set them up never blocks what the player was doing
    console.warn("Push notifications aren’t set up", error);
  }
}

/** Removes this phone's token before signing out, so the next player on it gets no pushes of yours. */
export async function stopPushNotifications() {
  const token = registeredToken;
  registeredToken = undefined;
  if (!token) return;
  await unregisterPushToken(token).catch(() => {});
}

/** Whether this phone allows pushes; checked again when the app comes back from Settings. */
export function usePushPermission() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") queryClient.invalidateQueries({ queryKey: permissionKey });
    });
    return () => subscription.remove();
  }, []);

  return useQuery({ queryKey: permissionKey, queryFn: getPushPermission });
}

export function useNotificationSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: fetchNotificationSettings });
}

export function useSaveNotificationSettings() {
  return useMutation({
    mutationFn: saveNotificationSettings,
    // The switch moves right away; a failed save puts it back
    onMutate: async (settings: NotificationSettings) => {
      await queryClient.cancelQueries({ queryKey: settingsKey });
      const previous = queryClient.getQueryData<NotificationSettings>(settingsKey);
      queryClient.setQueryData(settingsKey, settings);
      return { previous };
    },
    onError: (_, __, context) => queryClient.setQueryData(settingsKey, context?.previous),
  });
}
