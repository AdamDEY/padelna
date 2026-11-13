import {
  ADJUST_RANGE,
  COMPETITION_CAPS,
  EXPERIENCE_CAPS,
  MAX_ANSWER_POINTS,
  MAX_LEVEL,
  MIN_LEVEL,
  QUIZ_IDS,
  QUIZ_MAX_LEVEL,
  SELF_MAX_LEVEL,
  QUIZ_WEIGHTS,
  RACKET_CAP_BONUS,
  SKILL_IDS,
  type QuizId,
  type SkillId,
} from "@/data/level-quiz";

export type QuizResult = {
  /** Starting level before the player adjusts it, in steps of 0.1 */
  level: number;
  /** Weighted score of the answers, 0 to 100 */
  score: number;
  /** Best and weakest skill; left out when all skills are equal */
  strongest?: SkillId;
  weakest?: SkillId;
};

/** Rounds to one decimal, the precision a level is stored with. */
export function roundLevel(level: number) {
  return Math.round(level * 10 + 1e-9) / 10;
}

/** Keeps a level on the 1–7 scale. */
export function clampLevel(level: number) {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level));
}

/**
 * Turns the quiz answers (one answer index per question, in quiz order) into a starting level.
 * Returns undefined until every question is answered.
 *
 * 1. Each answer's points (0–4) are weighted by its question and averaged into a 0–100 score.
 * 2. The score is spread over 1.0 to `QUIZ_MAX_LEVEL`.
 * 3. The level is held down by what the player's background can back up: a newcomer can't be
 *    advanced, and nobody who has never played in a league starts among the best.
 */
export function scoreQuiz(answers: readonly (number | undefined)[]): QuizResult | undefined {
  const points = {} as Record<QuizId, number>;
  for (const [index, id] of QUIZ_IDS.entries()) {
    const answer = answers[index];
    if (answer === undefined) return undefined;
    points[id] = Math.min(MAX_ANSWER_POINTS, Math.max(0, answer));
  }

  let score = 0;
  for (const id of QUIZ_IDS) score += (QUIZ_WEIGHTS[id] * points[id]) / MAX_ANSWER_POINTS;

  let level = MIN_LEVEL + ((QUIZ_MAX_LEVEL - MIN_LEVEL) * score) / 100;

  const racketBonus = RACKET_CAP_BONUS[points.racket];
  const experienceCap = EXPERIENCE_CAPS[points.experience];
  if (experienceCap !== undefined) level = Math.min(level, experienceCap + racketBonus);
  const competitionCap = COMPETITION_CAPS[points.competition];
  if (competitionCap !== undefined) level = Math.min(level, competitionCap);

  const skills = SKILL_IDS.map((id) => points[id]);
  const best = Math.max(...skills);
  const worst = Math.min(...skills);
  const hasSpread = best !== worst;

  return {
    level: roundLevel(clampLevel(level)),
    score: Math.round(score * 10) / 10,
    strongest: hasSpread ? SKILL_IDS[skills.indexOf(best)] : undefined,
    weakest: hasSpread ? SKILL_IDS[skills.indexOf(worst)] : undefined,
  };
}

/** How far a player may move a starting level either way: half a level, kept between 1.0 and the most a player can give themselves. */
export function adjustBounds(level: number) {
  return {
    min: roundLevel(Math.max(MIN_LEVEL, level - ADJUST_RANGE) - level),
    max: roundLevel(Math.min(SELF_MAX_LEVEL, level + ADJUST_RANGE) - level),
  };
}
