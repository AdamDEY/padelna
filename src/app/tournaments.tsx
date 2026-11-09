import { router } from "expo-router";
import { Spinner } from "heroui-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { ChoiceChips } from "@/components/choice-chips";
import { LoadError } from "@/components/load-error";
import { Page } from "@/components/page";
import { TournamentCard } from "@/components/tournament-card";
import { TournamentFormatIcon } from "@/components/tournament-format-icon";
import { tournamentsKey, useTournaments } from "@/hooks/useTournaments";
import { errorMessage } from "@/lib/error-message";
import { queryClient } from "@/lib/query-client";
import { isThisWeek } from "@/lib/tournament";
import type { TournamentFormat, TournamentSummary } from "@/types/tournament";

type Filter = "all" | TournamentFormat;

function refresh() {
  return queryClient.refetchQueries({ queryKey: tournamentsKey });
}

export default function Tournaments() {
  const { t } = useTranslation();
  const query = useTournaments();
  const [filter, setFilter] = useState<Filter>("all");

  const { thisWeek, later } = useMemo(() => {
    const shown = (query.data ?? []).filter((tournament) => filter === "all" || tournament.format === filter);
    const isSoon = (tournament: TournamentSummary) => !!tournament.startsAt && isThisWeek(tournament.startsAt);
    return { thisWeek: shown.filter(isSoon), later: shown.filter((tournament) => !isSoon(tournament)) };
  }, [query.data, filter]);

  return (
    <Page>
      <Page.Header back title={t("tournaments.title")} />
      <Page.Body onRefresh={refresh}>
        <ChoiceChips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("tournaments.filterAll") },
            { value: "americano", label: t("tournaments.format.americano") },
            { value: "groups", label: t("tournaments.format.groups") },
          ]}
        />

        <View className="flex-row gap-2.5">
          <View className="flex-1 gap-1.5 rounded-[18px] bg-primary-soft p-3">
            <View className="flex-row items-center gap-1.5">
              <TournamentFormatIcon format="americano" size={18} />
              <Text className="shrink font-black text-[13px] text-primary-dark">{t("tournaments.format.americano")}</Text>
            </View>
            <Text className="font-normal text-[12px] leading-[17px] text-foreground">{t("tournaments.americanoExplainer")}</Text>
          </View>
          <View className="flex-1 gap-1.5 rounded-[18px] bg-lime-soft p-3">
            <View className="flex-row items-center gap-1.5">
              <TournamentFormatIcon format="groups" size={18} />
              <Text className="shrink font-black text-[13px] text-lime-foreground">{t("tournaments.format.groups")}</Text>
            </View>
            <Text className="font-normal text-[12px] leading-[17px] text-foreground">{t("tournaments.groupsExplainer")}</Text>
          </View>
        </View>

        {query.isPending ? (
          <Spinner accessibilityLabel={t("tournaments.loading")} className="self-center py-6" />
        ) : query.error && !query.data ? (
          <LoadError
            message={t("tournaments.loadFailed", { message: errorMessage(query.error) })}
            onRetry={() => query.refetch()}
            isRetrying={query.isRefetching}
          />
        ) : thisWeek.length === 0 && later.length === 0 ? (
          <View className="gap-1 rounded-[20px] border border-line bg-surface p-4">
            <Text className="font-black text-[15px] text-foreground">{t("tournaments.emptyTitle")}</Text>
            <Text className="font-normal text-[14px] text-muted">{t("tournaments.emptyText")}</Text>
          </View>
        ) : (
          <View className="gap-2.5">
            <Section title={t("tournaments.thisWeek")} tournaments={thisWeek} />
            <Section title={t("tournaments.later")} tournaments={later} className={thisWeek.length > 0 ? "mt-1.5" : undefined} />
          </View>
        )}
      </Page.Body>
    </Page>
  );
}

function Section({ title, tournaments, className }: { title: string; tournaments: TournamentSummary[]; className?: string }) {
  if (tournaments.length === 0) return null;
  return (
    <>
      <Text accessibilityRole="header" className={`font-bold text-[12px] uppercase tracking-[0.6px] text-muted ${className ?? ""}`}>
        {title}
      </Text>
      {tournaments.map((tournament) => (
        <TournamentCard
          key={tournament.id}
          tournament={tournament}
          onPress={() => router.push({ pathname: "/tournament/[id]", params: { id: tournament.id } })}
        />
      ))}
    </>
  );
}
