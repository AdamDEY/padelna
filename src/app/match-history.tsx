import { router, useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { Button } from "heroui-native";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FilterDropdown } from "@/components/filter-dropdown";
import { MatchHistoryHero } from "@/components/match-history-hero";
import { MatchHistoryRow } from "@/components/match-history-row";
import { MatchRowSkeleton } from "@/components/match-row-skeleton";
import { Page } from "@/components/page";
import { SegmentedControl } from "@/components/segmented-control";
import { useMatchHistory } from "@/hooks/useMatches";
import { formatMonthName } from "@/lib/format-date";
import { groupByMonth, summarize } from "@/lib/match-history";
import { errorMessage } from "@/lib/error-message";
import { pageStatusBarStyle } from "@/lib/theme-preference";

type ResultFilter = "all" | "won" | "lost";

/**
 * Match history, opened from the Profile (design canvas "Match history v2 · from profile"):
 * totals and your last ten results, filters, then every match by month.
 */
export default function MatchHistory() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: matches, error, refetch, isRefetching } = useMatchHistory();
  const [result, setResult] = useState<ResultFilter>("all");
  const [club, setClub] = useState<string>();
  const [partner, setPartner] = useState<string>();
  const [kind, setKind] = useState<string>();

  // White status bar text while the blue header is behind it; dark once it scrolls away
  const heroHeight = useRef(0);
  const isOverHero = useRef(true);
  const applyStatusBar = useCallback(() => {
    setStatusBarStyle(isOverHero.current ? "light" : pageStatusBarStyle());
  }, []);
  function handleScroll(y: number) {
    const over = y < heroHeight.current - insets.top;
    if (over !== isOverHero.current) {
      isOverHero.current = over;
      applyStatusBar();
    }
  }
  useFocusEffect(
    useCallback(() => {
      applyStatusBar();
      return () => setStatusBarStyle(pageStatusBarStyle());
    }, [applyStatusBar]),
  );

  const all = useMemo(() => matches ?? [], [matches]);
  const summary = useMemo(() => summarize(all), [all]);
  const oldest = all[all.length - 1];

  const clubOptions = useMemo(
    () => [...new Set(all.map((match) => match.clubName))].map((name) => ({ value: name, label: name })),
    [all],
  );
  const partnerOptions = useMemo(() => {
    const byId = new Map(all.flatMap((match) => (match.partner ? [[match.partner.id, match.partner] as const] : [])));
    return [...byId.values()].map((player) => ({ value: player.id, label: player.firstName }));
  }, [all]);
  const typeOptions = [
    { value: "friendly", label: t("match.kind.friendly") },
    { value: "competitive", label: t("match.kind.competitive") },
  ];

  const shown = useMemo(
    () =>
      all.filter(
        (match) =>
          (result === "all" || match.result === result) &&
          (club === undefined || match.clubName === club) &&
          (partner === undefined || match.partner?.id === partner) &&
          (kind === undefined || match.kind === kind),
      ),
    [all, result, club, partner, kind],
  );
  const months = useMemo(() => groupByMonth(shown), [shown]);

  const hasMatches = all.length > 0;

  return (
    <Page underStatusBar>
      <Page.Body className="gap-4 px-0" onScrollY={handleScroll}>
        <View onLayout={(event) => (heroHeight.current = event.nativeEvent.layout.height)}>
          <MatchHistoryHero
            subtitle={
              oldest
                ? t("history.sinceMonth", { count: all.length, month: formatMonthName(oldest.playedAt) })
                : undefined
            }
            summary={hasMatches ? summary : undefined}
            onBack={() => router.back()}
          />
        </View>

        <View className="gap-2.5 px-5">
          {error ? (
            <View className="items-start gap-2">
              <Text className="font-normal text-[14px] text-muted">
                {t("history.loadFailed", { message: errorMessage(error) })}
              </Text>
              <Button size="sm" variant="secondary" onPress={() => refetch()} isDisabled={isRefetching}>
                {t("matches.tryAgain")}
              </Button>
            </View>
          ) : matches === undefined ? (
            <MatchRowSkeleton variant="history" label={t("history.loading")} />
          ) : !hasMatches ? (
            <View className="items-center gap-1 rounded-3xl border border-line bg-surface p-6">
              <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
                {t("history.emptyTitle")}
              </Text>
              <Text className="text-center font-normal text-[14px] leading-5 text-muted">
                {t("history.emptyText")}
              </Text>
            </View>
          ) : (
            <>
              <SegmentedControl
                value={result}
                onChange={setResult}
                options={[
                  { value: "all", label: t("history.all", { count: all.length }) },
                  { value: "won", label: t("history.won", { count: summary.won }) },
                  { value: "lost", label: t("history.lost", { count: summary.lost }) },
                ]}
              />
              <View className="flex-row flex-wrap gap-2">
                <FilterDropdown
                  label={t("history.clubFilter")}
                  anyLabel={t("history.anyClub")}
                  options={clubOptions}
                  value={club}
                  onChange={setClub}
                />
                <FilterDropdown
                  label={t("history.partnerFilter")}
                  anyLabel={t("history.anyPartner")}
                  options={partnerOptions}
                  value={partner}
                  onChange={setPartner}
                />
                <FilterDropdown
                  label={t("history.typeFilter")}
                  anyLabel={t("history.anyType")}
                  options={typeOptions}
                  value={kind}
                  onChange={setKind}
                />
              </View>

              {months.length === 0 ? (
                <Text className="font-normal text-[14px] text-muted">{t("history.noneFound")}</Text>
              ) : (
                months.map((month) => (
                  <Fragment key={month.key}>
                    <Text
                      accessibilityRole="header"
                      className="mt-1 font-bold text-[13px] uppercase tracking-[0.6px] text-muted"
                    >
                      {month.label}
                      <Text className="font-semibold normal-case tracking-normal">
                        {" · "}
                        {t("history.monthSummary", {
                          played: month.matches.length,
                          won: month.won,
                          lost: month.lost,
                        })}
                      </Text>
                    </Text>
                    {month.matches.map((match) => (
                      <MatchHistoryRow
                        key={match.id}
                        match={match}
                        onPress={() => router.push({ pathname: "/match/[id]", params: { id: match.id } })}
                      />
                    ))}
                  </Fragment>
                ))
              )}
            </>
          )}
        </View>
      </Page.Body>
    </Page>
  );
}
