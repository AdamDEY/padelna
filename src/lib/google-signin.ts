import type { GoogleSignin as GoogleSigninModule } from "@react-native-google-signin/google-signin";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** Whether the Google client IDs are set, so the app can explain what's missing instead of crashing. */
export const isGoogleSignInConfigured = Boolean(webClientId && iosClientId);

let googleSignin: typeof GoogleSigninModule | undefined;

/**
 * Loads Google sign-in the first time it is needed. The library is native code: an app build
 * made before it was added (or Expo Go) doesn't contain it, and importing it up front would
 * crash the whole app at launch instead of only this button.
 */
export function getGoogleSignin() {
  if (googleSignin) return googleSignin;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleSignin } = require("@react-native-google-signin/google-signin");
    // The web client ID makes Google issue the ID token Supabase checks; the iOS one is the app's own client
    GoogleSignin.configure({ webClientId, iosClientId });
    googleSignin = GoogleSignin;
    return GoogleSignin as typeof GoogleSigninModule;
  } catch {
    throw new Error(
      "Google sign-in needs the Padelna development build. Rebuild the app on this device (it can’t run in Expo Go).",
    );
  }
}
