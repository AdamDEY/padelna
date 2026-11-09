import { useMyAccount } from "@/hooks/useMyProfile";
import { useCoachVerification } from "@/hooks/usePlayers";
import { shareLinkFor } from "@/lib/share-link";
import type { Player } from "@/types/player";

/** Everything the share card and its image show about the signed-in player. */
export type ShareProfile = {
  player: Player;
  name: string;
  level: number | undefined;
  isCoachVerified: boolean;
  code: string;
  link: string;
};

/** The signed-in player's share card, or undefined while their details load. */
export function useShareProfile() {
  const account = useMyAccount();
  const { data: coach } = useCoachVerification(account.data?.id);

  const me = account.data;
  const profile: ShareProfile | undefined = me && {
    player: {
      id: me.id,
      firstName: me.firstName,
      lastName: me.lastName,
      level: me.level,
      city: me.city,
      avatarUrl: me.avatarUrl,
    },
    name: `${me.firstName} ${me.lastName}`,
    level: me.level,
    isCoachVerified: Boolean(coach),
    code: me.shareCode,
    link: shareLinkFor(me.shareCode),
  };

  return { profile, error: account.error, refetch: account.refetch, isRefetching: account.isRefetching };
}
