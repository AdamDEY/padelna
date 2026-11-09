/**
 * The skill groups a coach scores (1 to 5). Same ids as the admin app's `SKILL_GROUPS`; scores are
 * stored by skill id, so a skill id this list doesn't know is simply left out of the summary.
 */
export const COACH_SKILL_GROUPS = [
  { id: "groundstrokes", skills: ["forehand", "backhand", "chiquita", "lob", "drop_shot"] },
  { id: "net", skills: ["forehand_volley", "backhand_volley", "block_volley"] },
  { id: "overheads", skills: ["bandeja", "vibora", "smash", "topspin_smash"] },
  { id: "walls", skills: ["back_wall", "side_wall", "double_wall"] },
  { id: "serve", skills: ["serve", "return"] },
  { id: "position", skills: ["net_position", "pair_movement", "footwork"] },
] as const;

export type CoachSkillGroupId = (typeof COACH_SKILL_GROUPS)[number]["id"];

export const COACH_MAX_SCORE = 5;

/** Average score (1–5) per group, leaving out groups the coach didn't score */
export function groupAverages(scores: Record<string, number>) {
  return COACH_SKILL_GROUPS.flatMap((group) => {
    const values = group.skills.flatMap((skill) => (typeof scores[skill] === "number" ? [scores[skill]] : []));
    if (values.length === 0) return [];
    return [{ id: group.id, average: values.reduce((sum, v) => sum + v, 0) / values.length }];
  });
}
