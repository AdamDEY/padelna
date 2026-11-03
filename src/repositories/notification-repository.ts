import { t } from "i18next";

import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/repositories/auth-repository";

/** Which pushes a player wants; everything is on until they change it */
export type NotificationSettings = {
  /** New messages in your match chats */
  chat: boolean;
  /** Joins, leaves, a full match, court booked, cancelled */
  matchUpdates: boolean;
  /** A score to confirm, players to rate */
  scores: boolean;
  /** Connection requests and accepted requests */
  connections: boolean;
};

const ALL_ON: NotificationSettings = { chat: true, matchUpdates: true, scores: true, connections: true };

type SettingsRow = { chat: boolean; match_updates: boolean; scores: boolean; connections: boolean };

/** Saves this phone's push token for the signed-in player, with the app's language for the push text. */
export async function registerPushToken(token: string, platform: "ios" | "android", language: string) {
  const { error } = await supabase.rpc("register_push_token", {
    p_token: token,
    p_platform: platform,
    p_language: language === "fr" ? "fr" : "en",
  });
  if (error) throw error;
}

/** Stops pushes to this phone, e.g. before signing out. */
export async function unregisterPushToken(token: string) {
  const { error } = await supabase.rpc("unregister_push_token", { p_token: token });
  if (error) throw error;
}

export async function fetchNotificationSettings(): Promise<NotificationSettings> {
  const { data, error } = await supabase
    .from("notification_settings")
    .select("chat, match_updates, scores, connections")
    .maybeSingle();
  if (error) throw error;
  if (!data) return ALL_ON;
  const row = data as SettingsRow;
  return { chat: row.chat, matchUpdates: row.match_updates, scores: row.scores, connections: row.connections };
}

export async function saveNotificationSettings(settings: NotificationSettings) {
  const user = await getCurrentUser();
  if (!user) throw new Error(t("errors.signedOut"));

  const { error } = await supabase.from("notification_settings").upsert({
    player_id: user.id,
    chat: settings.chat,
    match_updates: settings.matchUpdates,
    scores: settings.scores,
    connections: settings.connections,
  });
  if (error) throw error;
}
