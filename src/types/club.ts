import type { CourtTint } from "@/components/court-placeholder";
import type { Player } from "@/types/player";

export type Club = {
  id: string;
  name: string;
  distanceKm: number;
  courtCount: number;
  openMatchCount: number;
  /** Placeholder tint until the club has photos */
  placeholderTint: CourtTint;
  /** Neighbourhood or town, e.g. "Les Berges du Lac" */
  area: string;
  /** Governorate, used by the region filter */
  region: string;
  /** Average player rating, out of 5 */
  rating: number;
  /** You play here regularly */
  isMyClub?: boolean;
};

/** Everything the Club detail screen shows */
export type ClubDetails = Club & {
  address: string;
  /** How many photos the club has; the hero shows "1 / N" */
  photoCount: number;
  indoorCourts: number;
  outdoorCourts: number;
  /** Closing time today, "00:00" */
  openUntil: string;
  amenities: string[];
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
