// Matches with a confirmed score before the Profile shows win rates, streak, charts and partners
export const STATS_MIN_MATCHES = 5;

/** Where a level sits between two half levels: 4.62 is 24% of the way from 4.5 to 5.0. */
export function levelProgress(levelPoints: number) {
  const base = Math.floor(levelPoints * 2 + 1e-9) / 2;
  return { nextLevel: base + 0.5, progressToNext: (levelPoints - base) / 0.5 };
}
