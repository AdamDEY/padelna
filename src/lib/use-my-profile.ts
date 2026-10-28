import { useQuery } from "@tanstack/react-query";

import { myProfile as mockProfile } from "@/data/mock";
import { supabase } from "@/lib/supabase";
import type { PlayerProfile } from "@/types/profile";

export const myProfileKey = ["my-profile"] as const;

const sideLabels = { left: "Left side", right: "Right side", both: "Both sides" } as const;

async function fetchMyProfile(): Promise<PlayerProfile> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("You’re signed out. Sign in again.");

  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, city, side, play_style, level, avatar_url")
    .eq("id", auth.user.id)
    .single();
  if (error) throw error;

  // Level is the placeholder 6 until the quiz result exists. Stats, charts, partners and
  // reputation stay on mock data until their tables exist.
  return {
    ...mockProfile,
    player: {
      id: auth.user.id,
      firstName: data.first_name,
      lastName: data.last_name,
      level: data.level ?? undefined,
      city: data.city,
      avatarUrl: data.avatar_url ?? undefined,
    },
    city: data.city,
    side: sideLabels[data.side as keyof typeof sideLabels],
    playStyle: data.play_style.charAt(0).toUpperCase() + data.play_style.slice(1),
    level: data.level ?? mockProfile.level,
  };
}

/** The signed-in player's profile: real details from Supabase, the rest still mock. */
export function useMyProfile() {
  return useQuery({ queryKey: myProfileKey, queryFn: fetchMyProfile });
}
