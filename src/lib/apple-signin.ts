import type * as AppleAuthenticationModule from "expo-apple-authentication";

type AppleAuthentication = typeof AppleAuthenticationModule;

let appleAuthentication: AppleAuthentication | undefined;

/**
 * Loads Sign in with Apple the first time it is needed. It is native code, so an app build made
 * before it was added doesn't contain it, and importing it up front would crash the whole app.
 */
export function getAppleAuthentication() {
  if (appleAuthentication) return appleAuthentication;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    appleAuthentication = require("expo-apple-authentication") as AppleAuthentication;
    return appleAuthentication;
  } catch {
    throw new Error("Sign in with Apple needs the latest Padelna development build. Rebuild the app on this device.");
  }
}

/** Whether this device can show Sign in with Apple (iPhones on iOS 13+; never Android). */
export async function isAppleSignInAvailable() {
  try {
    return await getAppleAuthentication().isAvailableAsync();
  } catch {
    return false;
  }
}
