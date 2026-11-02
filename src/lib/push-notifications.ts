import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

// Android shows every push in a channel; it has to exist before the permission prompt
const ANDROID_CHANNEL_ID = "default";

/** "granted", "denied" (only Settings can change it) or "undetermined" (we can still ask) */
export type PushPermission = "granted" | "denied" | "undetermined";

function toPermission(status: Notifications.PermissionStatus): PushPermission {
  if (status === Notifications.PermissionStatus.GRANTED) return "granted";
  if (status === Notifications.PermissionStatus.DENIED) return "denied";
  return "undetermined";
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Padelna",
    importance: AndroidImportance.HIGH,
  });
}

export async function getPushPermission(): Promise<PushPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return toPermission(status);
}

/** Shows the system prompt if the player hasn't answered it yet; returns the answer either way. */
export async function requestPushPermission(): Promise<PushPermission> {
  await ensureAndroidChannel();
  const current = await getPushPermission();
  if (current !== "undetermined") return current;
  const { status } = await Notifications.requestPermissionsAsync();
  return toPermission(status);
}

/** This phone's Expo push token. Only call once permission is granted. */
export async function getExpoPushToken() {
  await ensureAndroidChannel();
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error("Push notifications need an EAS project ID in app.json.");
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}
