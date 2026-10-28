import { useEffect, useState } from "react";
import { Image } from "react-native";

import { fetchHomeOpenMatches, homeOpenMatchesKey, myMatchesKey } from "@/hooks/useMatches";
import { myProfileKey } from "@/hooks/useMyProfile";
import { queryClient } from "@/lib/query-client";
import { hasSavedSession } from "@/repositories/auth-repository";
import { fetchMyUpcomingMatches } from "@/repositories/match-repository";
import { fetchMyAccount } from "@/repositories/profile-repository";
import type { MyAccount } from "@/types/account";
import type { OpenMatch, UpcomingMatch } from "@/types/match";

// A slow or missing connection must never keep the splash screen up for long
const MAX_WAIT_MS = 3_000;

/** Loads what Home shows, and the photos in it, into the cache. Failures are fine: Home retries. */
async function prepareHome() {
  if (!(await hasSavedSession())) return;

  await Promise.allSettled([
    queryClient.prefetchQuery({ queryKey: myProfileKey, queryFn: fetchMyAccount }),
    queryClient.prefetchQuery({ queryKey: myMatchesKey, queryFn: fetchMyUpcomingMatches }),
    queryClient.prefetchQuery({ queryKey: homeOpenMatchesKey, queryFn: fetchHomeOpenMatches }),
  ]);

  // Photos too, so avatars don't pop in after the screen appears
  const account = queryClient.getQueryData<MyAccount>(myProfileKey);
  const upcoming = queryClient.getQueryData<UpcomingMatch[]>(myMatchesKey) ?? [];
  const open = queryClient.getQueryData<OpenMatch[]>(homeOpenMatchesKey) ?? [];
  const photos = new Set<string>();
  if (account?.avatarUrl) photos.add(account.avatarUrl);
  for (const match of [...upcoming, ...open]) {
    for (const player of match.players) if (player.avatarUrl) photos.add(player.avatarUrl);
  }
  await Promise.allSettled([...photos].map((url) => Image.prefetch(url)));
}

/**
 * Prepares Home's data while the splash screen is still showing. Returns true once it is
 * ready, or after a few seconds at most.
 */
export function usePrepareHome() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, MAX_WAIT_MS));
    Promise.race([prepareHome(), timeout]).finally(() => setIsReady(true));
  }, []);

  return isReady;
}
