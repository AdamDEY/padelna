import type { CourtTint } from "@/components/court-placeholder";

export type Club = {
  id: string;
  name: string;
  distanceKm: number;
  courtCount: number;
  openMatchCount: number;
  /** Placeholder tint until the club has photos */
  placeholderTint: CourtTint;
};
