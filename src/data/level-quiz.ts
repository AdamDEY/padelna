// Level quiz in profile setup step 3. The wording lives in the language files, under quiz.<id>.
//
// Every question has five answers, worth 0 to 4 points (lowest level first). A question's
// weight says how much it counts towards the level (the weights add up to 100), and the
// guardrails stop a player from claiming more than their background backs up.
// `src/lib/level-quiz-score.ts` turns the answers into a level. The numbers here are a first
// calibration: agree them with the coaches and change them in this file only.

/** Questions in the order they are asked: background first, then skills, then competition. */
export const QUIZ_IDS = [
  "racket",
  "experience",
  "frequency",
  "training",
  "serve",
  "net",
  "walls",
  "overhead",
  "tactics",
  "competition",
] as const;

export type QuizId = (typeof QUIZ_IDS)[number];

/** The answers a question offers, lowest level first. An answer's number is also its points. */
export type QuizQuestion = { id: QuizId; answers: readonly number[] };

/** The five answers most questions have. */
export const ANSWER_INDEXES = [0, 1, 2, 3, 4] as const;
export const MAX_ANSWER_POINTS = 4;

// Only these three make sense for how someone competes, so the 2 and 3 points are skipped
const COMPETITION_ANSWERS = [0, 1, 4] as const;

export const levelQuizQuestions: QuizQuestion[] = QUIZ_IDS.map((id) => ({
  id,
  answers: id === "competition" ? COMPETITION_ANSWERS : ANSWER_INDEXES,
}));

/**
 * How much each question counts, out of 100. Skills on court count most, and the walls most of
 * all because they are what separates padel from other racket sports. Background (how long,
 * how often, lessons) counts less: it says little about how someone plays today.
 */
export const QUIZ_WEIGHTS: Record<QuizId, number> = {
  racket: 8,
  experience: 10,
  frequency: 6,
  training: 6,
  serve: 11,
  net: 12,
  walls: 14,
  overhead: 12,
  tactics: 11,
  competition: 10,
};

/** The skill questions, used for "Strongest" and "To work on" on the result screen. */
export const SKILL_IDS = ["serve", "net", "walls", "overhead", "tactics"] as const satisfies readonly QuizId[];

export type SkillId = (typeof SKILL_IDS)[number];

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 7;

/**
 * The highest level a player can give themselves at setup, by quiz, by moving the quiz level or by
 * picking one when they skip the quiz. Higher levels have to be earned in matches or set by a coach.
 */
export const SELF_MAX_LEVEL = 5.5;

/** A quiz alone gives 1.0 to the self-chosen maximum. */
export const QUIZ_MAX_LEVEL = SELF_MAX_LEVEL;

/** How far a player may move their starting level on the result screen, in either direction. */
export const ADJUST_RANGE = 0.5;
export const ADJUST_STEP = 0.1;

/**
 * Top level for a player by how long they have played padel (answer index 0 to 1; no limit after
 * that), raised when they come from another racket sport: tennis players learn padel fast.
 */
export const EXPERIENCE_CAPS = [2.5, 3.5] as const;
export const RACKET_CAP_BONUS = [0, 0, 0.5, 1, 1] as const;

/** Top level for a player who only plays casually or in friendly club tournaments (answers 0 and 1; national players have no limit). */
export const COMPETITION_CAPS = [4.5, 4.5] as const;

export type LevelBand =
  | "beginner"
  | "improving"
  | "intermediate"
  | "advanced"
  | "competitive"
  | "expert";

/** The bands in order. A band runs from its `from` level up to the next band's. */
export const LEVEL_BANDS: { band: LevelBand; from: number }[] = [
  { band: "beginner", from: 1 },
  { band: "improving", from: 2 },
  { band: "intermediate", from: 3 },
  { band: "advanced", from: 4 },
  { band: "competitive", from: 5 },
  { band: "expert", from: 6 },
];

/** The name shown next to a level, e.g. "Starting level · Intermediate". */
export function levelBand(level: number): LevelBand {
  let found = LEVEL_BANDS[0].band;
  for (const { band, from } of LEVEL_BANDS) if (level >= from) found = band;
  return found;
}

/**
 * Pick your level (when the quiz is skipped): one card per band, each with its lower and upper half.
 * Expert can't be picked, because it is above `SELF_MAX_LEVEL`: a coach sets it.
 */
export const SELF_LEVEL_OPTIONS = LEVEL_BANDS.map(({ band, from }) => ({
  band,
  lower: from,
  upper: from + 0.5,
  isLocked: from > SELF_MAX_LEVEL,
}));
