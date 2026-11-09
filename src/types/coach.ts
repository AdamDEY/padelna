/** A player's latest coach evaluation (a paper sheet filled in by a coach, entered in the admin app) */
export type CoachVerification = {
  coachName: string;
  /** The level the coach set, on the 1–7 scale */
  level: number;
  /** Score from 1 to 5 per skill id (see `COACH_SKILL_GROUPS`) */
  scores: Record<string, number>;
  /** Only filled in for the player it is about */
  comment: string;
  evaluatedAt: Date;
};
