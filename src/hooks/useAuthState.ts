import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { queryClient } from "@/lib/query-client";
import { getSavedUserId, onSignedInChange } from "@/repositories/auth-repository";
import { hasProfile } from "@/repositories/profile-repository";

/**
 * Where a player stands when the app opens:
 * - loading: not known yet (the splash screen is still up)
 * - signedOut: no session on this device
 * - needsSetup: signed in, but hasn't finished profile setup
 * - ready: signed in with a profile
 */
export type AuthState = "loading" | "signedOut" | "needsSetup" | "ready";

export const profileExistsKey = (userId: string) => ["profile-exists", userId] as const;

function useRawAuthState(): AuthState {
  // undefined until local storage has been read, null when nobody is signed in
  const [userId, setUserId] = useState<string | null>();

  useEffect(() => {
    let isActive = true;
    const read = () =>
      getSavedUserId().then((id) => {
        if (isActive) setUserId(id);
      });
    read();
    const stopWatching = onSignedInChange(read);
    return () => {
      isActive = false;
      stopWatching();
    };
  }, []);

  const profileExists = useQuery(
    {
      queryKey: profileExistsKey(userId ?? ""),
      queryFn: () => hasProfile(userId!),
      enabled: Boolean(userId),
      // Setup marks it as true when it finishes; it only changes if the account is deleted
      staleTime: Infinity,
    },
    queryClient,
  );

  if (userId === undefined) return "loading";
  if (userId === null) return "signedOut";
  if (profileExists.isPending) return "loading";
  // Offline at launch: assume an existing player rather than sending them to setup
  if (profileExists.isError) return "ready";
  return profileExists.data ? "ready" : "needsSetup";
}

/**
 * The auth state, but "loading" only until the first answer. Later checks (right after signing
 * in, say) keep the previous state, so the screens don't disappear while they run.
 */
export function useAuthState(): AuthState {
  const next = useRawAuthState();
  const [settled, setSettled] = useState<AuthState>("loading");

  // Adjusting state while rendering is React's way to derive it from the previous render
  if (next !== "loading" && next !== settled) setSettled(next);

  return settled;
}
