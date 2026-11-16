import { Platform } from "react-native";
import Constants from "expo-constants";

import type { FeedbackKind } from "@/data/feedback-kinds";
import { supabase } from "@/lib/supabase";

export type FeedbackInput = {
  kind: FeedbackKind;
  message: string;
  /** The route the player was on, e.g. /matches */
  screen: string;
};

/**
 * Sends feedback to the team. The database adds the sender's profile id and full name from their
 * session, so the app only says what it was and where it happened.
 */
export async function submitFeedback({ kind, message, screen }: FeedbackInput) {
  const { error } = await supabase.rpc("submit_feedback", {
    p_kind: kind,
    p_message: message,
    p_screen: screen,
    p_app_version: Constants.expoConfig?.version ?? "",
    p_platform: Platform.OS,
  });
  if (error) throw error;
}
