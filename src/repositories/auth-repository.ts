import type { User } from "@supabase/supabase-js";

import * as Crypto from "expo-crypto";

import { getAppleAuthentication } from "@/lib/apple-signin";
import { getGoogleSignin, isGoogleSignInConfigured } from "@/lib/google-signin";
import { supabase } from "@/lib/supabase";

/** The signed-in player, or null when there is no session. */
export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** The id of the player saved on this device, or null. Reads local storage only, so it works offline. */
export async function getSavedUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Whether a session is saved on this device. Reads local storage only, so it works offline. */
export async function hasSavedSession() {
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
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

/**
 * Signs in (or signs up, for a new player) with a Google account and returns the player's id,
 * or null when they close Google's sheet. Throws with a readable message otherwise.
 */
export async function signInWithGoogle() {
  if (!isGoogleSignInConfigured) {
    throw new Error("Google sign-in isn’t set up yet. Add the Google client IDs to .env.local.");
  }

  const response = await getGoogleSignin().signIn();
  if (response.type !== "success") return null;
  const token = response.data.idToken;
  if (!token) throw new Error("Google didn’t return a sign-in token. Please try again.");

  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token });
  if (error) throw error;
  return data.user.id;
}

/**
 * Signs in (or signs up) with an Apple ID and returns the player's id, or null when they close
 * Apple's sheet. Throws with a readable message otherwise.
 */
export async function signInWithApple() {
  const AppleAuthentication = getAppleAuthentication();

  // Apple signs a hash of the nonce into its token; Supabase gets the original to compare
  const nonce = Array.from(await Crypto.getRandomBytesAsync(16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);

  let credential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (error) {
    // They closed Apple's sheet
    if ((error as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
    throw error;
  }
  if (!credential.identityToken) throw new Error("Apple didn’t return a sign-in token. Please try again.");

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce,
  });
  if (error) throw error;

  // Apple only shares the name the very first time, so keep it for the setup screen
  const { givenName, familyName } = credential.fullName ?? {};
  if (givenName || familyName) {
    await supabase.auth.updateUser({
      data: {
        given_name: givenName ?? "",
        family_name: familyName ?? "",
        full_name: [givenName, familyName].filter(Boolean).join(" "),
      },
    });
  }
  return data.user.id;
}

/** The name from the player's Google or Apple account, to prefill setup. Empty for email sign-ups. */
export async function getSuggestedName() {
  const user = await getCurrentUser();
  const meta = user?.user_metadata ?? {};
  const [first = "", ...rest] = String(meta.full_name ?? meta.name ?? "").trim().split(/\s+/);
  return {
    firstName: String(meta.given_name ?? first),
    lastName: String(meta.family_name ?? rest.join(" ")),
  };
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
