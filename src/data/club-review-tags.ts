/**
 * What players can flag when rating a club; negative ones show in orange once picked.
 * Same list as `c_tags` in `submit_club_review`, and names in `labels.clubTags` in the locale files.
 */
export const clubReviewTagOptions = [
  { label: "Fresh turf" },
  { label: "True bounce" },
  { label: "Good AC" },
  { label: "Great lighting" },
  { label: "Clean glass" },
  { label: "Friendly staff" },
  { label: "Easy booking" },
  { label: "Sea breeze" },
  { label: "Worn rental rackets", negative: true },
  { label: "Flat balls", negative: true },
  { label: "Slippery turf", negative: true },
  { label: "Windy", negative: true },
  { label: "Hard to park", negative: true },
  { label: "Small changing rooms", negative: true },
  { label: "Dim evening light", negative: true },
];

// Most tags one review can carry
export const MAX_CLUB_REVIEW_TAGS = 5;

/** Whether a tag shows in orange */
export function isNegativeClubTag(label: string) {
  return clubReviewTagOptions.some((tag) => tag.label === label && tag.negative);
}
