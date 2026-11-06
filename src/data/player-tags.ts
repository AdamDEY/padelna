/**
 * What players can say about someone when they rate them (shown as "What players say").
 * All positive, so an anonymous tag can't be used against anyone. Keep in sync with `c_tags`
 * in the `submit_ratings` database function; the readable names are in `playerTags` in the
 * locale files.
 */
export const PLAYER_TAG_GROUPS = [
  {
    key: "attitude",
    tags: [
      "fair_play",
      "great_teammate",
      "positive_vibes",
      "calm_under_pressure",
      "respectful",
      "on_time",
      "great_communication",
    ],
  },
  {
    key: "game",
    tags: [
      "strong_smash",
      "solid_at_the_net",
      "great_defence",
      "consistent",
      "strong_serve",
      "smart_tactics",
      "great_lobs",
      "good_bandeja",
      "fighter",
      "quick_on_court",
      "good_wall_play",
    ],
  },
] as const;

export type PlayerTag = (typeof PLAYER_TAG_GROUPS)[number]["tags"][number];

/** Most tags one player can give another (same as the database) */
export const MAX_TAGS_PER_PLAYER = 5;

/** A tag with how many players gave it */
export type PlayerTagCount = { tag: PlayerTag; count: number };
