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
  rating: number;
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
