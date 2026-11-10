import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AmericanoRecapView } from "@/components/americano-recap-view";
import { LoadError } from "@/components/load-error";
import { Page } from "@/components/page";
import { TournamentHero } from "@/components/tournament-hero";
import { TournamentRecapView } from "@/components/tournament-recap-view";
import { TournamentShareSheet } from "@/components/tournament-share-sheet";
import { useHeroStatusBar } from "@/hooks/useHeroStatusBar";
import { useMyAccount } from "@/hooks/useMyProfile";
import { useTournament, useTournamentLive } from "@/hooks/useTournaments";
import { errorMessage } from "@/lib/error-message";
import { formatTeamLevel } from "@/lib/tournament";
import { partnerOf, recapOf } from "@/lib/tournament-history";
import { shareResultOf } from "@/lib/tournament-share";

/**
 * The recap of one finished tournament, opened from Tournament history. Groups + knockout and
 * Americano each have their own layout (design canvas "Tournament recap · finished (groups +
 * knockout)" and "Americano recap · finished"); both end with Share result.
 */
export default function TournamentRecapScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { onHeroLayout, onScrollY } = useHeroStatusBar();
  const live = useTournamentLive(id);
  // Only for the level range chip; the recap works without it
  const detail = useTournament(id).data;
  const myId = useMyAccount().data?.id;
  const [isShareOpen, setIsShareOpen] = useState(false);
  // The sheet is drawn above everything, so it closes when another screen opens over this one
  useFocusEffect(useCallback(() => () => setIsShareOpen(false), []));

  const tournament = live.data;
  const recap = useMemo(() => (tournament ? recapOf(tournament, myId) : undefined), [tournament, myId]);
  const partner = useMemo(() => (tournament ? partnerOf(tournament, myId) : undefined), [tournament, myId]);
  const result = useMemo(() => (tournament && recap ? shareResultOf(tournament, recap) : undefined), [tournament, recap]);
  const levelRange =
    detail?.levelMin !== undefined && detail.levelMax !== undefined
      ? `${formatTeamLevel(detail.levelMin)} – ${formatTeamLevel(detail.levelMax)}`
      : undefined;

  // Nothing to recap yet: show the blue header with what's going on, so the status bar stays readable
  function placeholder(children: ReactNode) {
    return (
      <Page underStatusBar>
        <Page.Body className="gap-4 px-0" onScrollY={onScrollY}>
          <View onLayout={onHeroLayout}>
            <TournamentHero title={t("tournamentHistory.title")} onBack={() => router.back()} />
          </View>
          <View className="gap-2.5 px-5">{children}</View>
        </Page.Body>
      </Page>
    );
  }

  if (live.isPending) {
    return placeholder(<Spinner accessibilityLabel={t("tournamentRecap.loading")} className="self-center" />);
  }
  if (!tournament || !recap || !result) {
    return placeholder(
      <>
        {live.error ? (
          <LoadError
            message={t("tournamentRecap.loadFailed", { message: errorMessage(live.error) })}
            onRetry={() => live.refetch()}
            isRetrying={live.isRefetching}
          />
        ) : (
          <View className="items-center gap-1 rounded-3xl border border-line bg-surface p-6">
            <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
              {t("tournamentRecap.notFound")}
            </Text>
            <Text className="text-center font-normal text-[14px] leading-5 text-muted">{t("tournamentRecap.notFoundText")}</Text>
          </View>
        )}
      </>,
    );
  }
  if (tournament.status !== "finished") {
    return placeholder(
      <View className="items-center gap-3 rounded-3xl border border-line bg-surface p-6">
          <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
            {t("tournamentRecap.notFinished")}
          </Text>
          <Text className="text-center font-normal text-[14px] leading-5 text-muted">{t("tournamentRecap.notFinishedText")}</Text>
          <Button variant="secondary" onPress={() => router.replace({ pathname: "/tournament/[id]", params: { id } })}>
            {t("tournaments.detail.tournament")}
          </Button>
      </View>,
    );
  }

  return (
    <Page underStatusBar>
      <Page.Body className="gap-4 px-0" onScrollY={onScrollY}>
        {recap.kind === "groups" ? (
          <TournamentRecapView
            tournament={tournament}
            recap={recap}
            levelRange={levelRange}
            partner={partner}
            myId={myId}
            onBack={() => router.back()}
            onHeroLayout={onHeroLayout}
            onShare={() => setIsShareOpen(true)}
          />
        ) : (
          <AmericanoRecapView
            tournament={tournament}
            recap={recap}
            myId={myId}
            onBack={() => router.back()}
            onHeroLayout={onHeroLayout}
            onShare={() => setIsShareOpen(true)}
          />
        )}
      </Page.Body>

      <TournamentShareSheet
        isOpen={isShareOpen}
        onOpenChange={setIsShareOpen}
        tournamentId={tournament.id}
        tournamentName={tournament.name}
        result={result}
        clubName={tournament.clubName}
        partner={partner}
      />
    </Page>
  );
}
