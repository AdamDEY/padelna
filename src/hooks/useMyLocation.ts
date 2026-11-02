import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";

import type { Coordinates } from "@/lib/club";

// A fix this old is plenty for "how far is this club"
const MAX_AGE_MS = 10 * 60_000;
const REFRESH_MS = 5 * 60_000;

async function fetchMyLocation(): Promise<Coordinates | null> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return null;

  try {
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: MAX_AGE_MS })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    // No fix right now (location services off, or none yet): clubs just show without a distance
    return null;
  }
}

/**
 * Where the player is, to show how far clubs are. Asks for permission the first time it is
 * used; `undefined` until it's known, and `null` when they said no or there is no fix.
 */
export function useMyLocation() {
  return useQuery({
    queryKey: ["my-location"],
    queryFn: fetchMyLocation,
    staleTime: REFRESH_MS,
    retry: false,
  }).data;
}
