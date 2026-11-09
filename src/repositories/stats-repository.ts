import { t } from "i18next";

import { supabase } from "@/lib/supabase";
import type { Player } from "@/types/player";
import type { ProfileStats, WinRateStat } from "@/types/profile";

// English short month names: the same keys `translateLabel("months", …)` looks up
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Bucket = { matches: number; wins: number };

type StatsRow = {
  matches_played: number;
  matches_scored: number;
  wins: number;
  streak_won: boolean | null;
  streak_run: number | null;
  won_first_set: number;
  third_sets: number;
  won_third_set: number;
  opponents: Partial<Record<"lower" | "same" | "higher", Bucket>>;
  partners: {
    id: string;
    first_name: string;
    last_name: string;
    city: string;
    level: number | null;
    avatar_url: string | null;
    matches: number;
    wins: number;
  }[];
  level_history: { month: number; level: number }[];
};

const percent = (part: number, whole: number) => Math.round((part / whole) * 100);

/** The signed-in player's results from their confirmed matches. */
export async function fetchMyStats(): Promise<ProfileStats> {
  const { data, error } = await supabase.rpc("get_my_stats");
  if (error) throw error;
  const row = data as StatsRow | null;
  if (!row) throw new Error(t("errors.signedOut"));

  const byOpponent: [string, Bucket | undefined][] = [
    ["Lower than you", row.opponents.lower],
    ["Same level", row.opponents.same],
    ["Higher than you", row.opponents.higher],
  ];
  const opponentStats = byOpponent.flatMap(([label, bucket]): WinRateStat[] =>
    bucket && bucket.matches > 0 ? [{ label, winRate: percent(bucket.wins, bucket.matches) }] : [],
  );
  const setStats: WinRateStat[] = [];
  if (row.matches_scored > 0) setStats.push({ label: "First set", winRate: percent(row.won_first_set, row.matches_scored) });
  if (row.third_sets > 0) setStats.push({ label: "Third set", winRate: percent(row.won_third_set, row.third_sets) });

  return {
    matchesPlayed: Number(row.matches_played),
    matchesScored: Number(row.matches_scored),
    winRate: row.matches_scored > 0 ? percent(row.wins, row.matches_scored) : 0,
    streak:
      row.streak_won === null || !row.streak_run
        ? undefined
        : { result: row.streak_won ? "won" : "lost", count: Number(row.streak_run) },
    levelHistory: (row.level_history ?? []).map((point) => ({
      month: MONTHS[point.month - 1],
      level: Number(point.level),
    })),
    winRates: [
      { title: "By opponent level", stats: opponentStats },
      { title: "By set", stats: setStats },
    ].filter((group) => group.stats.length > 0),
    bestPartners: row.partners.map((partner) => ({
      player: {
        id: partner.id,
        firstName: partner.first_name,
        lastName: partner.last_name,
        city: partner.city,
        level: partner.level === null ? undefined : Number(partner.level),
        avatarUrl: partner.avatar_url ?? undefined,
      } satisfies Player,
      matches: Number(partner.matches),
      wins: Number(partner.wins),
    })),
  };
}
