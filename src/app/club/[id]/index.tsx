import { Button } from "heroui-native";
import { useLocalSearchParams } from "expo-router";
import { Clock, Heart } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { CourtHero } from "@/components/court-hero";
import { IconButton } from "@/components/icon-button";
import { BookingNoticeSheet } from "@/components/booking-notice-sheet";
import { ClubMatchRow } from "@/components/club-match-row";
import { CreateMatchSheet } from "@/components/create-match-sheet";
import { InfoNote } from "@/components/info-note";
import { LoadError } from "@/components/load-error";
import { Page } from "@/components/page";
import { SectionHeader } from "@/components/section-header";
import { useClubCard } from "@/hooks/useClubs";
import { useUpcomingOpenMatches } from "@/hooks/useMatches";
import { translateLabel } from "@/i18n";
import { shouldSkipBookingNotice } from "@/lib/booking-notice";
import { formatDistance, formatPhone, todaysHours } from "@/lib/club";
import { showDirections } from "@/lib/directions";
import { errorMessage } from "@/lib/error-message";

// How far the white sheet slides up over the photo
const SHEET_OVERLAP = 34;

export default function ClubDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { club, isLoading, error, refetch, isRefetching } = useClubCard(id);
  const openMatchesQuery = useUpcomingOpenMatches();
  const openMatches = openMatchesQuery.data;
  const [isSaved, setIsSaved] = useState(false);
  const [isShowingNotice, setIsShowingNotice] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const matchesHere = useMemo(
    () =>
      (openMatches ?? [])
        .filter((match) => match.clubId === id)
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    [openMatches, id],
  );

  // Players who ticked "Don't show this again" go straight to the form
  async function startCreating() {
    if (await shouldSkipBookingNotice()) setIsCreating(true);
    else setIsShowingNotice(true);
  }

  if (!club) {
    return (
      <Page>
        <Page.Header back />
        <Page.Body>
          {error ? (
            <LoadError
              message={t("clubDetail.loadFailed", { message: errorMessage(error) })}
              onRetry={() => refetch()}
              isRetrying={isRefetching}
            />
          ) : isLoading ? null : (
            <Page.Title description={t("clubDetail.notFoundText")}>
              {t("clubDetail.notFoundTitle")}
            </Page.Title>
          )}
        </Page.Body>
      </Page>
    );
  }

  const hoursToday = todaysHours(club.hours);
  const isOpenForMatches = club.status === "published";
  const place = club.address || `${club.area}, ${club.city}`;

  const stats = [
    { value: String(club.courtCount), label: t("clubDetail.courts") },
    { value: `${club.indoorCourts} + ${club.outdoorCourts}`, label: t("clubDetail.indoorOutdoor") },
    ...(hoursToday
      ? [
          hoursToday.closed || !hoursToday.closesAt
            ? { value: "–", label: t("clubDetail.closedToday") }
            : { value: hoursToday.closesAt, label: t("clubDetail.openUntil") },
        ]
      : []),
  ];

  return (
    <Page surface underStatusBar>
      <Page.Body className="gap-0 px-0">
        <CourtHero
          tint={club.placeholderTint}
          photoCount={club.photoCount}
          rightAction={
            <IconButton
              icon={Heart}
              label={isSaved ? t("clubDetail.unsave") : t("clubDetail.save")}
              filled={isSaved}
              onPress={() => setIsSaved((saved) => !saved)}
              className="border-0 bg-white/90"
            />
          }
        />

        <View
          className="gap-[18px] rounded-t-[28px] bg-surface px-5 pt-[22px]"
          style={{ marginTop: -SHEET_OVERLAP }}
        >
          <View className="gap-1.5">
            <Text
              accessibilityRole="header"
              className="font-black text-[26px] tracking-[-0.4px] text-foreground"
            >
              {club.name}
            </Text>
            <Text className="font-normal text-[15px] text-muted">
              {[place, club.distanceKm === undefined ? null : formatDistance(club.distanceKm)]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>

          {club.status === "temporarily_closed" ? (
            <InfoNote icon={Clock} tone="warning" title={t("clubDetail.temporarilyClosed")}>
              {club.closedNote ?? ""}
            </InfoNote>
          ) : null}
          {club.status === "closed" ? (
            <InfoNote icon={Clock} tone="warning" title={t("clubDetail.closedTitle")}>
              {t("clubDetail.closedText")}
            </InfoNote>
          ) : null}

          <View className="flex-row gap-2.5">
            {stats.map((stat) => (
              <View
                key={stat.label}
                accessible
                accessibilityLabel={`${stat.label}: ${stat.value}`}
                className="flex-1 gap-0.5 rounded-2xl bg-background p-3"
              >
                <Text className="font-black text-[20px] text-foreground">{stat.value}</Text>
                <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          {club.description ? (
            <Text className="font-normal text-[15px] leading-[22px] text-ink-2">{club.description}</Text>
          ) : null}

          {club.facilities.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {club.facilities.map((facility) => (
                <Text
                  key={facility}
                  className="overflow-hidden rounded-[14px] bg-out-of-range px-3 py-1.5 font-semibold text-[13px] text-ink-2"
                >
                  {translateLabel("facilities", facility)}
                </Text>
              ))}
            </View>
          ) : null}

          <View className="gap-2.5">
            <SectionHeader size="sm" title={t("clubDetail.openHere", { count: matchesHere.length })} />
            {matchesHere.map((match) => (
              <ClubMatchRow key={match.id} match={match} />
            ))}
            {openMatchesQuery.error && !openMatches ? (
              <LoadError
                message={t("clubDetail.matchesFailed", { message: errorMessage(openMatchesQuery.error) })}
                onRetry={() => openMatchesQuery.refetch()}
                isRetrying={openMatchesQuery.isRefetching}
              />
            ) : matchesHere.length === 0 ? (
              <Text className="font-normal text-[14px] text-muted">
                {t("clubDetail.noneHere")}
              </Text>
            ) : null}
          </View>
        </View>
      </Page.Body>

      <Page.Footer className="flex-row border-t border-line bg-surface">
        <Button
          size="lg"
          variant="secondary"
          onPress={() => showDirections(club)}
          className="flex-1"
        >
          {t("clubDetail.directions")}
        </Button>
        {isOpenForMatches ? (
          <Button size="lg" className="flex-[1.4]" onPress={startCreating}>
            {t("clubDetail.createHere")}
          </Button>
        ) : null}
      </Page.Footer>

      <BookingNoticeSheet
        clubName={club.name}
        phone={club.phone ? formatPhone(club.phone) : undefined}
        isOpen={isShowingNotice}
        onOpenChange={setIsShowingNotice}
        onCreate={() => {
          setIsShowingNotice(false);
          setIsCreating(true);
        }}
      />
      <CreateMatchSheet isOpen={isCreating} onOpenChange={setIsCreating} initialClubName={club.name} />
    </Page>
  );
}
