import { PressableFeedback } from "heroui-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { CourtPlaceholder } from "@/components/court-placeholder";
import { formatDistance } from "@/lib/club";
import type { ClubCard } from "@/types/club";

/** A club in the All clubs list: thumbnail, name, place, distance, open matches. */
export function ClubListItem({ club, onPress }: { club: ClubCard; onPress?: () => void }) {
  const { t } = useTranslation();
  const details = [
    club.area,
    club.region,
    club.distanceKm === undefined ? null : formatDistance(club.distanceKm),
    t("club.courts", { count: club.courtCount }),
  ]
    .filter(Boolean)
    .join(" · ");
  const openMatches =
    club.openMatchCount === 0 ? null : t("club.openMatches", { count: club.openMatchCount });

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[
        club.name,
        details,
        openMatches ?? t("clubs.noOpenMatchesA11y"),
        club.isMyClub ? t("clubs.yourClubA11y") : null,
      ]
        .filter(Boolean)
        .join(", ")}
    >
      <View className="flex-row items-center gap-3 rounded-[18px] border border-line bg-surface p-2.5">
        <CourtPlaceholder tint={club.placeholderTint} size={56} />
        <View className="min-w-0 flex-1 gap-[3px]">
          <View className="flex-row items-center justify-between gap-2">
            <Text numberOfLines={1} className="flex-1 font-bold text-[15px] text-foreground">
              {club.name}
            </Text>
          </View>
          <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
            {details}
          </Text>
          <View className="flex-row items-center gap-1.5">
            {openMatches ? (
              <Text className="overflow-hidden rounded-[9px] bg-lime-soft px-2 py-[3px] font-bold text-[11px] text-lime-foreground">
                {openMatches}
              </Text>
            ) : (
              <Text className="font-semibold text-[11px] text-muted">{t("clubs.noOpenMatches")}</Text>
            )}
            {club.isMyClub ? (
              <Text className="overflow-hidden rounded-[9px] bg-primary-soft px-2 py-[3px] font-bold text-[11px] text-primary-dark">
                {t("clubs.yourClub")}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </PressableFeedback>
  );
}
