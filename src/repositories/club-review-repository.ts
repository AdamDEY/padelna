import { ratingAspects } from "@/data/club-review-aspects";
import { isNegativeClubTag } from "@/data/club-review-tags";
import { supabase } from "@/lib/supabase";
import type { ClubRatings, ClubReview, ReviewScores } from "@/types/club";

// Reviews on the club page and the reviews screen
const REVIEWS_LIMIT = 100;

type RatingsRow = {
  review_count: number;
  rating: number | null;
  tags: { tag: string; count: number }[];
  courts: { number: number; rating: number }[];
} & Record<(typeof ratingAspects)[number]["key"], number | null>;

type ReviewRow = {
  id: string;
  author_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  level: number | null;
  city: string;
  court_number: number | null;
  court_indoor: boolean | null;
  rating: number;
  tags: string[];
  comment: string;
  posted_at: string;
  times_played: number;
} & Record<(typeof ratingAspects)[number]["key"], number | null>;

/** What a player gives for a club: stars for what they rated, tags and a comment. */
export type ClubReviewInput = {
  clubId: string;
  /** The court they played on, when they said */
  courtId?: string;
  scores: ReviewScores;
  tags: string[];
  comment: string;
};

/** The overall score, the average per aspect, what players flag most and the average per court. */
export async function fetchClubRatings(clubId: string): Promise<ClubRatings> {
  const { data, error } = await supabase.rpc("get_club_ratings", { p_club_id: clubId });
  if (error) throw error;
  const row = (data as RatingsRow[])[0];

  return {
    rating: Number(row.rating ?? 0),
    reviewCount: row.review_count,
    ratingBreakdown: ratingAspects.flatMap((aspect) =>
      row[aspect.key] === null ? [] : [{ label: aspect.label, value: Number(row[aspect.key]) }],
    ),
    reviewTags: row.tags.map((item) => ({
      label: item.tag,
      count: item.count,
      negative: isNegativeClubTag(item.tag) || undefined,
    })),
    courtRatings: row.courts.map((court) => ({ number: court.number, rating: Number(court.rating) })),
  };
}

/** A club's reviews, newest first. */
export async function fetchClubReviews(clubId: string): Promise<ClubReview[]> {
  const { data, error } = await supabase.rpc("get_club_reviews", {
    p_club_id: clubId,
    p_limit: REVIEWS_LIMIT,
  });
  if (error) throw error;

  return (data as ReviewRow[]).map((row) => ({
    id: row.id,
    author: {
      id: row.author_id,
      firstName: row.first_name,
      lastName: row.last_name,
      level: row.level ?? undefined,
      city: row.city,
      avatarUrl: row.avatar_url ?? undefined,
    },
    courtName: row.court_number === null ? undefined : `Court ${row.court_number}`,
    isIndoor: row.court_indoor ?? undefined,
    postedAt: new Date(row.posted_at),
    rating: Number(row.rating),
    text: row.comment,
    timesPlayedHere: row.times_played,
    scores: Object.fromEntries(
      ratingAspects.flatMap((aspect) => (row[aspect.key] === null ? [] : [[aspect.key, row[aspect.key]]])),
    ),
    tags: row.tags,
  }));
}

/** Rates a club. A player's earlier review of the same club is replaced. */
export async function submitClubReview({ clubId, courtId, scores, tags, comment }: ClubReviewInput) {
  const { error } = await supabase.rpc("submit_club_review", {
    p_club_id: clubId,
    p_court_id: courtId ?? null,
    p_surface: scores.surface ?? null,
    p_glass: scores.glass ?? null,
    p_lighting: scores.lighting ?? null,
    p_gear: scores.gear ?? null,
    p_rooms: scores.rooms ?? null,
    p_staff: scores.staff ?? null,
    p_tags: tags,
    p_comment: comment.trim(),
  });
  if (error) throw error;
}
