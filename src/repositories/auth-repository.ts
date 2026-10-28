import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

/** The signed-in player, or null when there is no session. */
export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Calls back once with the current state and again whenever the player signs in or out
 * (not on routine token refreshes). Returns a function that stops listening.
 */
export function onSignedInChange(callback: (isSignedIn: boolean) => void) {
  let wasSignedIn: boolean | undefined;
  const { data } = supabase.auth.onAuthStateChange((_, session) => {
    const isSignedIn = session !== null;
    if (isSignedIn === wasSignedIn) return;
    wasSignedIn = isSignedIn;
    callback(isSignedIn);
  });
  return () => data.subscription.unsubscribe();
}

/** Signs in with email and password and returns the player's id. Throws with a readable message. */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data.user.id;
}

/**
 * Creates the account. `hasSession` is false when email confirmation is on:
 * there is no session until the player confirms.
 */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw error;
  return { hasSession: data.session !== null };
}

/** Signing out clears the session on the device even if the network call fails. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Deletes the signed-in player's account and the session left on the device. */
export async function deleteOwnAccount() {
  const { error } = await supabase.rpc("delete_own_account");
  if (error) throw error;
  // The account is gone on the server; this clears the session left on the device
  await supabase.auth.signOut({ scope: "local" });
}
