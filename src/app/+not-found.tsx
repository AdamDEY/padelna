import { Redirect } from "expo-router";

import { useAuthState } from "@/hooks/useAuthState";

/**
 * A route the player can't open (Home while signed out, a deep link to a match before signing in)
 * ends up here, so send them where their state says they belong instead of showing an error.
 */
export default function NotFound() {
  const authState = useAuthState();

  if (authState === "loading") return null;
  if (authState === "signedOut") return <Redirect href="/sign-in" />;
  if (authState === "needsSetup") return <Redirect href="/setup" />;
  return <Redirect href="/" />;
}
