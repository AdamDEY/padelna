import type { CourtTint } from "@/components/court-placeholder";
import type { Club, ClubCard, ClubHours } from "@/types/club";
import type { OpenMatch } from "@/types/match";

const TINTS: CourtTint[] = ["blue", "green", "peach", "lime"];
const EARTH_RADIUS_KM = 6371;
const TUNISIA_TIME_ZONE = "Africa/Tunis";

export type Coordinates = { latitude: number; longitude: number };

/** The same club always gets the same placeholder colour. */
export function clubTint(clubId: string): CourtTint {
  let hash = 0;
  for (const char of clubId) hash = (hash * 31 + char.charCodeAt(0)) % 1000;
  return TINTS[hash % TINTS.length];
}

/** Straight-line distance between two points, in km. */
export function distanceKm(from: Coordinates, to: Coordinates) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function formatDistance(km: number) {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Today's hours at the club, in Tunisian time (the clubs' clocks); undefined if they aren't set. */
export function todaysHours(hours: ClubHours[], now = new Date()): ClubHours | undefined {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TUNISIA_TIME_ZONE }).format(now);
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday) + 1;
  return hours.find((item) => item.day === day);
}

/** "71 000 000" style number with the country code, from the 8 digits we store. */
export function formatPhone(digits: string) {
  return `+216 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
}

/**
 * Adds what the lists need to each club: how many matches are open there, whether it's one
 * of yours and how far it is. Clubs nobody can book (drafts never reach the app) stay in, so
 * a match at a closed club still links to it.
 */
export function toClubCards(
  clubs: Club[],
  openMatches: OpenMatch[],
  myClubIds: Set<string>,
  location?: Coordinates,
): ClubCard[] {
  return clubs.map((club) => {
    const courts = club.courts.filter((court) => court.active);
    return {
      ...club,
      placeholderTint: clubTint(club.id),
      courtCount: courts.length,
      indoorCourts: courts.filter((court) => court.indoor).length,
      outdoorCourts: courts.filter((court) => !court.indoor).length,
      openMatchCount: openMatches.filter((match) => match.clubId === club.id).length,
      distanceKm:
        location && club.latitude !== undefined && club.longitude !== undefined
          ? distanceKm(location, { latitude: club.latitude, longitude: club.longitude })
          : undefined,
      isMyClub: myClubIds.has(club.id),
    };
  });
}
