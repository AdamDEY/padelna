import { useQuery } from "@tanstack/react-query";

import { myProfile as mockProfile } from "@/data/mock";
import { fetchMyAccount } from "@/repositories/profile-repository";
import type { MyAccount } from "@/types/account";
import type { PlayerProfile } from "@/types/profile";

export const myProfileKey = ["my-profile"] as const;

const sideLabels = { left: "Left side", right: "Right side", both: "Both sides" } as const;

/** Level is the placeholder 6 until the quiz result exists. Stats, charts, partners and reputation stay mock until their tables exist. */
function toPlayerProfile(account: MyAccount): PlayerProfile {
  return {
    ...mockProfile,
    player: {
      id: account.id,
      firstName: account.firstName,
      lastName: account.lastName,
      level: account.level,
      city: account.city,
      avatarUrl: account.avatarUrl,
    },
    city: account.city,
    side: sideLabels[account.side],
    playStyle: account.playStyle.charAt(0).toUpperCase() + account.playStyle.slice(1),
    level: account.level ?? mockProfile.level,
  };
}

/** The signed-in player's saved details, for forms. */
export function useMyAccount() {
  return useQuery({ queryKey: myProfileKey, queryFn: fetchMyAccount });
}

/** The signed-in player's profile: real details from Supabase, the rest still mock. */
export function useMyProfile() {
  return useQuery({ queryKey: myProfileKey, queryFn: fetchMyAccount, select: toPlayerProfile });
}
