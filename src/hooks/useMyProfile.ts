import { useQuery } from "@tanstack/react-query";

import { myProfile as mockProfile } from "@/data/mock";
import { levelProgress } from "@/lib/profile-stats";
import { ageFromBirthDate } from "@/lib/age";
import { fetchMyAccount } from "@/repositories/profile-repository";
import type { MyAccount } from "@/types/account";
import type { PlayerProfile } from "@/types/profile";

export const myProfileKey = ["my-profile"] as const;

/** The player's details; match statistics come from `useMyStats`. */
function toPlayerProfile(account: MyAccount): PlayerProfile {
  const level = account.level ?? mockProfile.level;
  return {
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
    level,
    ...levelProgress(account.levelPoints ?? level),
  };
}

/** The signed-in player's saved details, for forms. */
export function useMyAccount() {
  return useQuery({ queryKey: myProfileKey, queryFn: fetchMyAccount });
}

/** The signed-in player's profile details from Supabase. */
export function useMyProfile() {
  return useQuery({ queryKey: myProfileKey, queryFn: fetchMyAccount, select: toPlayerProfile });
}
