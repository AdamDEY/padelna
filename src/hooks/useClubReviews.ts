import { useMutation, useQuery } from "@tanstack/react-query";

import { queryClient } from "@/lib/query-client";
import {
  fetchClubRatings,
  fetchClubReviews,
  submitClubReview,
} from "@/repositories/club-review-repository";

export const clubReviewsKey = ["club-reviews"] as const;

/** Overall score, per-aspect averages, popular tags and per-court scores for a club. */
export function useClubRatings(clubId: string | undefined) {
  return useQuery({
    queryKey: [...clubReviewsKey, "ratings", clubId],
    queryFn: () => fetchClubRatings(clubId!),
    enabled: clubId !== undefined,
  });
}

/** A club's reviews, newest first. */
export function useClubReviews(clubId: string | undefined) {
  return useQuery({
    queryKey: [...clubReviewsKey, "list", clubId],
    queryFn: () => fetchClubReviews(clubId!),
    enabled: clubId !== undefined,
  });
}

export function useSubmitClubReview() {
  return useMutation({
    mutationFn: submitClubReview,
    onSettled: () => queryClient.invalidateQueries({ queryKey: clubReviewsKey }),
  });
}
