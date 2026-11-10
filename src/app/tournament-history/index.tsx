import { router } from "expo-router";
import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { LoadError } from "@/components/load-error";
import { MatchRowSkeleton } from "@/components/match-row-skeleton";
import { Page } from "@/components/page";
import { SegmentedControl } from "@/components/segmented-control";
import { TournamentHero } from "@/components/tournament-hero";
import { TournamentHistoryRow } from "@/components/tournament-history-row";
import { TournamentUpcomingCard } from "@/components/tournament-upcoming-card";
import { useHeroStatusBar } from "@/hooks/useHeroStatusBar";
import { useTournaments, useTournamentHistory } from "@/hooks/useTournaments";
import { errorMessage } from "@/lib/error-message";
import { formatMatchDay, formatMonthName } from "@/lib/format-date";
import { placeText, summarizeHistory, type HistoryItem } from "@/lib/tournament-history";

type KindFilter = "all" | "groups" | "americano";

/** Newest first, grouped by the month each tournament was played; undated ones go last. */
function groupByMonth(items: HistoryItem[]) {
  const months: { key: string; label?: string; items: HistoryItem[] }[] = [];
  for (const item of items) {
    const date = item.summary.startsAt;
    const key = date ? `${date.getFullYear()}-${date.getMonth()}` : "none";
    const last = months[months.length - 1];
    if (last?.key === key) last.items.push(item);
    else months.push({ key, label: date ? formatMonthName(date) : undefined, items: [item] });
  }
  return months;
}

/**
 * Tournament history, opened from the Profile (design canvas "Tournament history · from profile"):
 * titles and totals, the tournament I'm registered in, then every finished one by month.
 */
export default function TournamentHistory() {
  const { t } = useTranslation();
  const { onHeroLayout, onScrollY } = useHeroStatusBar();
  const { items, error, refetch, isRefetching } = useTournamentHistory();
  const { data: tournaments } = useTournaments();
  const [kind, setKind] = useState<KindFilter>("all");

  const all = useMemo(() => items ?? [], [items]);
  const summary = useMemo(() => summarizeHistory(all), [all]);
  const oldest = [...all].reverse().find((item) => item.summary.startsAt);
  const latestTitle = summary.titles[0];

  const knockoutCount = all.filter((item) => item.summary.format === "groups").length;
  const americanoCount = all.length - knockoutCount;
  const shown = useMemo(
    () => all.filter((item) => kind === "all" || item.summary.format === kind),
    [all, kind],
  );
  const months = useMemo(() => groupByMonth(shown), [shown]);

  // The one I'm registered in and that isn't over yet; live ones come first in the list
  const upcoming = tournaments?.find((tournament) => tournament.myStatus === "confirmed");
  const showUpcoming = upcoming !== undefined && (kind === "all" || upcoming.format === kind);

  const hasHistory = all.length > 0;
  const titleDate = latestTitle?.summary.startsAt ? formatMatchDay(latestTitle.summary.startsAt) : "";
  const stats = hasHistory
    ? [
        { value: String(summary.played), label: t("tournamentHistory.played") },
        { value: String(summary.titles.length), label: t("tournamentHistory.title", { count: summary.titles.length }), accent: summary.titles.length > 0 },
        { value: summary.bestAmericano !== undefined ? placeText(summary.bestAmericano) : "–", label: t("tournamentHistory.bestAmericano") },
        { value: `${summary.won} – ${summary.lost}`, label: t("tournamentHistory.matchesWonLost") },
      ]
    : undefined;

  return (
    <Page underStatusBar>
      <Page.Body className="gap-4 px-0" onScrollY={onScrollY}>
        <View onLayout={onHeroLayout}>
          <TournamentHero
            title={t("tournamentHistory.title")}
            subtitle={
              oldest?.summary.startsAt
                ? t("tournamentHistory.sinceMonth", { count: all.length, month: formatMonthName(oldest.summary.startsAt) })
                : undefined
            }
            highlight={
              latestTitle
                ? {
                    title: t("tournamentHistory.titleLine", {
                      titles: t("tournamentHistory.titles", { count: summary.titles.length }),
                      name: latestTitle.summary.name,
                    }),
                    text: latestTitle.partner
                      ? t("tournamentHistory.wonWith", { name: `${latestTitle.partner.firstName} ${latestTitle.partner.lastName.charAt(0)}.`, date: titleDate })
                      : t("tournamentHistory.wonAlone", { date: titleDate }),
                  }
                : undefined
            }
            stats={stats}
            onBack={() => router.back()}
          />
        </View>

        <View className="gap-2.5 px-5">
          {error ? (
            <LoadError
              message={t("tournamentHistory.loadFailed", { message: errorMessage(error) })}
              onRetry={() => refetch()}
              isRetrying={isRefetching}
            />
          ) : items === undefined ? (
            <MatchRowSkeleton variant="history" label={t("tournamentHistory.loading")} />
          ) : (
            <Fragment>
              {hasHistory ? (
                <SegmentedControl
                  value={kind}
                  onChange={setKind}
                  size="sm"
                  options={[
                    { value: "all", label: t("tournamentHistory.all", { count: all.length }) },
                    { value: "groups", label: t("tournamentHistory.knockout", { count: knockoutCount }) },
                    { value: "americano", label: t("tournamentHistory.americano", { count: americanoCount }) },
                  ]}
                />
              ) : null}

              {showUpcoming ? (
                <TournamentUpcomingCard
                  tournament={upcoming}
                  onPress={() => router.push({ pathname: "/tournament/[id]", params: { id: upcoming.id } })}
                />
              ) : null}

              {!hasHistory ? (
                <View className="items-center gap-1 rounded-3xl border border-line bg-surface p-6">
                  <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
                    {t("tournamentHistory.emptyTitle")}
                  </Text>
                  <Text className="text-center font-normal text-[14px] leading-5 text-muted">
                    {t("tournamentHistory.emptyText")}
                  </Text>
                </View>
              ) : months.length === 0 ? (
                <Text className="font-normal text-[14px] text-muted">{t("tournamentHistory.noneFound")}</Text>
              ) : (
                months.map((month) => (
                  <Fragment key={month.key}>
                    <Text
                      accessibilityRole="header"
                      className="mt-1 font-bold text-[13px] uppercase tracking-[0.6px] text-muted"
                    >
                      {month.label ?? t("tournamentHistory.undated")}
                      <Text className="font-semibold normal-case tracking-normal">
                        {" · "}
                        {t("tournamentHistory.playedInMonth", { count: month.items.length })}
                      </Text>
                    </Text>
                    {month.items.map((item) => (
                      <TournamentHistoryRow
                        key={item.summary.id}
                        item={item}
                        onPress={() => router.push({ pathname: "/tournament-history/[id]", params: { id: item.summary.id } })}
                      />
                    ))}
                  </Fragment>
                ))
              )}
            </Fragment>
          )}
        </View>
      </Page.Body>
    </Page>
  );
}
