import { useToast } from "heroui-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { RateClubSheet } from "@/components/rate-club-sheet";
import type { ClubCard } from "@/types/club";

/**
 * What a "Rate the club" button needs: `start` for its onPress and `sheet` to render next to the
 * page (a sheet inside a scrolling body doesn't open). Only players who have played a match at the
 * club can review it.
 */
export function useRateClub(club: Pick<ClubCard, "id" | "name" | "courts" | "isMyClub"> | undefined) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  function start() {
    if (!club) return;
    // The database checks this too; saying it up front saves filling in the form for nothing
    if (!club.isMyClub) {
      toast.show({
        label: t("rateClub.playFirst"),
        description: t("rateClub.playFirstText", { club: club.name }),
      });
      return;
    }
    setIsOpen(true);
  }

  const sheet = club ? <RateClubSheet club={club} isOpen={isOpen} onOpenChange={setIsOpen} /> : null;
  return { start, sheet };
}
