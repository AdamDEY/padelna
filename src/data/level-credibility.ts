// How far a player's level can be trusted, by how it was set. A level a coach verified has its own
// "Coach verified" badge instead, so it has no percentage here. The numbers are a first calibration:
// agree them with the coaches.

/** `quiz`: the player took the level quiz. `self`: they skipped it and picked a level themselves. */
export type LevelSource = "quiz" | "self";

export const LEVEL_CREDIBILITY: Record<LevelSource, number> = {
  quiz: 50,
  self: 20,
};
