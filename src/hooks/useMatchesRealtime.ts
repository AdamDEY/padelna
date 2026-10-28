import { useEffect } from "react";

import { refreshMatches } from "@/hooks/useMatches";
import { onSignedInChange } from "@/repositories/auth-repository";
import { subscribeToMatchChanges } from "@/repositories/match-repository";

/**
 * Keeps match screens up to date while signed in: when anyone joins, leaves, creates or
 * cancels a match, the lists and the match on screen reload. Call it once, near the root.
 */
export function useMatchesRealtime() {
  useEffect(() => {
    let stopListening: (() => void) | undefined;

    const stopWatchingAuth = onSignedInChange((isSignedIn) => {
      stopListening?.();
      stopListening = isSignedIn ? subscribeToMatchChanges(refreshMatches) : undefined;
    });

    return () => {
      stopWatchingAuth();
      stopListening?.();
    };
  }, []);
}
