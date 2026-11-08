import { useQuery } from "@tanstack/react-query";

import { myProfile as mockProfile } from "@/data/mock";
import { ageFromBirthDate } from "@/lib/age";
import { fetchMyAccount } from "@/repositories/profile-repository";
import type { MyAccount } from "@/types/account";
import type { PlayerProfile } from "@/types/profile";

export const myProfileKey = ["my-profile"] as const;

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
    gender: account.gender,
    age: account.birthDate ? ageFromBirthDate(account.birthDate) : undefined,
    side: account.side,
    playStyle: account.playStyle,
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
