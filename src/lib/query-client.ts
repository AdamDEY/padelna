import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";

// React Query only knows about browser tabs. On a phone, "focus" means the app coming back from
// the background, so stale data (older than staleTime) reloads when the player returns to it.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener("change", (state) => handleFocus(state === "active"));
  return () => subscription.remove();
});

/** One client for the app, so screens outside React (sign out, setup) can clear or refresh the cache. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Profile data rarely changes under the player; avoid refetching on every tab focus
      staleTime: 60_000,
      retry: 1,
    },
  },
});
