import type { CourtTint } from "@/components/court-placeholder";
import type { Player } from "@/types/player";

export type Court = {
  id: string;
  number: number;
  indoor: boolean;
  /** Switched-off courts stay readable for past matches but can't be booked */
  active: boolean;
};

export type ClubStatus = "draft" | "published" | "temporarily_closed" | "closed";

/** Opening hours for one day; day 1 is Monday. Closing before opening means after midnight. */
export type ClubHours = {
  day: number;
  closed: boolean;
  /** "HH:MM" */
  opensAt?: string;
  /** "HH:MM" */
  closesAt?: string;
};

/** A club as the database holds it. Anything the club hasn't filled in yet is left out. */
export type Club = {
  id: string;
  name: string;
  /** Neighbourhood or town, e.g. "Les Berges du Lac" */
  area: string;
  city: string;
  /** Governorate, used by the region filter */
  region: string;
  address: string;
  description: string;
  latitude?: number;
  longitude?: number;
  /** The 8 digits after +216 */
  phone?: string;
  whatsapp?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  facilities: string[];
  status: ClubStatus;
  /** What players see while the club is temporarily closed */
  closedNote?: string;
  courts: Court[];
  hours: ClubHours[];
  photoCount: number;
};

/** A club with what the lists and the club page show on top of it. */
export type ClubCard = Club & {
  /** Placeholder tint until the club's photos show */
  placeholderTint: CourtTint;
  /** Courts that can be booked */
  courtCount: number;
  indoorCourts: number;
  outdoorCourts: number;
  /** Matches in the next 30 days that still have a free spot */
  openMatchCount: number;
  /** Left out until the player shares their location and the club has a map pin */
  distanceKm?: number;
  /** You've played here */
  isMyClub: boolean;
};

/** Average ratings for a club, from its player reviews. Not backed by the database yet. */
export type ClubRatings = {
  /** Average player rating, out of 5 */
  rating: number;
  reviewCount: number;
  /** Average per aspect, out of 5 */
  ratingBreakdown: { label: string; value: number }[];
  /** What players mention most; negative ones show in orange */
  reviewTags: { label: string; count: number; negative?: boolean }[];
  /** Average court rating (surface, glass, lighting), one per court in order */
  courtRatings?: number[];
  /** Newest first */
  reviews?: ClubReview[];
};

/** What a review talks about, for the topic filter on the reviews screen */
export type ReviewTopic = "courts" | "gear" | "facilities" | "staff";

/** Per-aspect scores out of 5; aspects the player skipped are left out */
export type ReviewScores = {
  surface?: number;
  glass?: number;
  lighting?: number;
  gear?: number;
  rooms?: number;
  staff?: number;
};

export type ClubReview = {
  id: string;
  author: Player;
  courtName: string;
  postedAt: Date;
  rating: number;
  text: string;
  /** When the reviewed match started, "20:00" */
  playedTime?: string;
  /** How many times the author has played at this club */
  timesPlayedHere?: number;
  scores?: ReviewScores;
  topics: ReviewTopic[];
  helpfulCount: number;
  clubReplied?: boolean;
};
