import { useQuery } from "@tanstack/react-query";

import { fetchMyStats } from "@/repositories/stats-repository";

export const myStatsKey = ["my-stats"] as const;

/** The signed-in player's results: win rate, streak, level over time and partners. */
export function useMyStats() {
  return useQuery({ queryKey: myStatsKey, queryFn: fetchMyStats });
}
