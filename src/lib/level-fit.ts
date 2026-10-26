export type LevelFit = "great" | "good" | "above" | "below";

// Within this distance of a match's range, the match still counts as a good fit
const GOOD_FIT_MARGIN = 0.5;

/** How well a match's level range fits a player's level */
export function levelFit(level: number, min: number, max: number): LevelFit {
  if (level >= min && level <= max) return "great";
  if (level < min) return min - level <= GOOD_FIT_MARGIN ? "good" : "above";
  return level - max <= GOOD_FIT_MARGIN ? "good" : "below";
}

export function isPlayableFit(fit: LevelFit) {
  return fit === "great" || fit === "good";
}

const fitRank: Record<LevelFit, number> = { great: 0, good: 1, below: 2, above: 3 };

/** Best fit first, then earliest */
export function compareByFit<T extends { startsAt: Date; fit: LevelFit }>(a: T, b: T) {
  return fitRank[a.fit] - fitRank[b.fit] || a.startsAt.getTime() - b.startsAt.getTime();
}
