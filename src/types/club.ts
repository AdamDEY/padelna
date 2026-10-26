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
  latestReview?: ClubReview;
};

export type ClubReview = {
  id: string;
  author: Player;
  courtName: string;
  postedAt: Date;
  rating: number;
  text: string;
};
