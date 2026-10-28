import { QueryClient } from "@tanstack/react-query";

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
