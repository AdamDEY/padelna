import { router, useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { Button, cn, PressableFeedback, Spinner, useToast } from "heroui-native";
import { ChevronRight, LogOut } from "lucide-react-native";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CoachVerificationCard } from "@/components/coach-verification-card";
import { Icon } from "@/components/icon";
import { NewPlayerCards } from "@/components/new-player-cards";
import { LevelChart } from "@/components/level-chart";
import { Page } from "@/components/page";
import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { ProfileHero } from "@/components/profile-hero";
import { ShareProfileSheet } from "@/components/share-profile-sheet";
import { WinRateBars } from "@/components/win-rate-bars";
import { useMatchHistory, useMyPastMatches } from "@/hooks/useMatches";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useMyFinishedTournaments } from "@/hooks/useTournaments";
import { useMyStats } from "@/hooks/useMyStats";
import { useCoachVerification, useLevelSource, usePlayerDetails, usePlayerTags } from "@/hooks/usePlayers";
import { stopPushNotifications } from "@/hooks/usePushNotifications";
import { STATS_MIN_MATCHES } from "@/lib/profile-stats";
import { queryClient } from "@/lib/query-client";
import { signOut } from "@/repositories/auth-repository";
import { errorMessage } from "@/lib/error-message";
import { pageStatusBarStyle } from "@/lib/theme-preference";

export default function Profile() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: profile, error, refetch, isRefetching } = useMyProfile();
  const { data: pastMatches } = useMyPastMatches();
  const { data: history } = useMatchHistory();
  const { data: stats } = useMyStats();
  const { data: finishedTournaments } = useMyFinishedTournaments();
  // The profile's own friend count is mock, so ask for the real one
  const friendCount = usePlayerDetails(profile?.player.id).data?.friendCount ?? 0;
  const { data: tags = [] } = usePlayerTags(profile?.player.id);
  const { data: coach } = useCoachVerification(profile?.player.id);
  const { data: levelSource } = useLevelSource(profile?.player.id);

  const [isShareOpen, setIsShareOpen] = useState(false);
  // The sheet is drawn above everything, so it must close when another screen opens over this one
  // (a player's code opened as a link)
  useFocusEffect(
    useCallback(() => () => setIsShareOpen(false), []),
  );

  const insets = useSafeAreaInsets();
  // White status bar text while the blue header is behind it; dark once it scrolls away
  const heroHeight = useRef(0);
  const statusBarOverHero = useRef(true);
  // The loading and error states have no blue header, so the status bar stays dark there
  const hasHero = profile !== undefined;

  const applyStatusBar = useCallback(() => {
    setStatusBarStyle(hasHero && statusBarOverHero.current ? "light" : pageStatusBarStyle());
  }, [hasHero]);

  function handleScroll(y: number) {
    const overHero = y < heroHeight.current - insets.top;
    if (overHero !== statusBarOverHero.current) {
      statusBarOverHero.current = overHero;
      applyStatusBar();
    }
  }

  // Only while this tab is showing; other tabs have light backgrounds
  useFocusEffect(
    useCallback(() => {
      applyStatusBar();
      return () => setStatusBarStyle(pageStatusBarStyle());
    }, [applyStatusBar]),
  );
  useEffect(() => {
    applyStatusBar();
  }, [applyStatusBar]);

  if (!profile) {
    return (
      <Page>
        <Page.Body scroll={false} className="items-center justify-center gap-3">
          {error ? (
            <>
              <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
                {t("profile.loadFailed")}
              </Text>
              <Text className="text-center font-normal text-[14px] text-muted">{errorMessage(error)}</Text>
              <Button variant="secondary" onPress={() => refetch()} isDisabled={isRefetching}>
                {t("matches.tryAgain")}
              </Button>
            </>
          ) : (
            <Spinner accessibilityLabel={t("profile.loading")} />
          )}
        </Page.Body>
      </Page>
    );
  }

  // Win rates, partners and the level chart only mean something after a few scored matches
  const hasStats = stats !== undefined && stats.matchesScored >= STATS_MIN_MATCHES;
  const noStats = stats !== undefined && !hasStats;
  const levelHistory = stats?.levelHistory ?? [];
  const first = levelHistory[0];
  const latest = levelHistory[levelHistory.length - 1];
  const levelChange = latest && first ? latest.level - first.level : 0;
  const hasNoMatches = pastMatches !== undefined && pastMatches.length === 0;

  async function logOut() {
    // Signing out clears the session on the device even if the network call fails
    try {
      // While still signed in, so this phone stops getting your pushes
      await stopPushNotifications();
      await signOut();
    } catch (error) {
      toast.show({
        variant: "danger",
        label: t("settings.logOutFailed"),
        description: errorMessage(error),
      });
      return;
    }
    // The next player to sign in on this device must not see this profile; the route guards
    // then send you to sign in
    queryClient.clear();
  }

  const links = [
    {
      label: t("profile.matchHistory"),
      // The history screen counts the real matches; the profile's own number is still mock
      value: t("profile.matchesCount", { count: history?.length ?? pastMatches?.length ?? 0 }),
      onPress: () =>
        hasNoMatches
          ? toast.show({ label: t("profile.historyLockedTitle"), description: t("profile.historyLockedText") })
          : router.push("/match-history"),
    },
    {
      label: t("profile.tournamentHistory"),
      // Only the count here; the history screen reads each tournament's results
      value:
        finishedTournaments === undefined ? undefined : t("profile.tournamentsCount", { count: finishedTournaments.length }),
      onPress: () =>
        finishedTournaments?.length === 0
          ? toast.show({ label: t("tournamentHistory.lockedTitle"), description: t("tournamentHistory.lockedText") })
          : router.push("/tournament-history"),
    },
    {
      label: t("profile.friends"),
      // The real count, from your connections; the profile's own number is still mock
      value: String(friendCount),
      onPress: () =>
        friendCount === 0
          ? toast.show({ label: t("friends.lockedTitle"), description: t("friends.lockedText") })
          : router.push("/friends"),
    },
  ];

  return (
    <Page underStatusBar>
      <Page.Body className="gap-[18px] px-0" onScrollY={handleScroll}>
        <View onLayout={(event) => (heroHeight.current = event.nativeEvent.layout.height)}>
          <ProfileHero
            profile={profile}
            stats={stats}
            hasPlayed={hasStats}
            friendCount={friendCount}
            isCoachVerified={Boolean(coach)}
            levelSource={levelSource}
            onPressSettings={() => router.push("/settings")}
            onPressShare={() => setIsShareOpen(true)}
          />
        </View>

        {coach ? (
          <View className="mx-4">
            <CoachVerificationCard coach={coach} />
          </View>
        ) : null}

        {noStats ? (
          <NewPlayerCards friendCount={friendCount} levelLabel={profile.level.toFixed(1)} />
        ) : hasStats ? (
          <Card>
            <View className="flex-row items-baseline justify-between">
              <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
                {t("profile.levelOverTime")}
              </Text>
              {levelChange > 0 ? (
                <Text className="font-bold text-[13px] text-success">
                  {t("profile.levelUp", {
                    change: levelChange.toFixed(1),
                    count: levelHistory.length,
                  })}
                </Text>
              ) : null}
            </View>
            <LevelChart points={levelHistory} />
          </Card>
        ) : null}

        {hasStats ? (
          <Fragment>
          {stats.winRates.length > 0 ? (
          <Card className="gap-3.5">
            <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
              {t("profile.whereYouWin")}
            </Text>
            <WinRateBars groups={stats.winRates} />
          </Card>
          ) : null}

          {stats.bestPartners.length > 0 ? (
          <Card>
            <View className="flex-row items-baseline justify-between">
              <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
                {t("profile.bestPartners")}
              </Text>
              <Text className="font-normal text-[12px] text-muted">{t("profile.winRateTogether")}</Text>
            </View>
            {stats.bestPartners.map(({ player, matches, wins }) => {
              const rate = Math.round((wins / matches) * 100);
              return (
                <PressableFeedback
                  key={player.id}
                  accessibilityRole="button"
                  accessibilityLabel={t("profile.partnerA11y", {
                    name: shortNameOf(player),
                    matches: t("profile.matchesCount", { count: matches }),
                    wins: t("profile.winsCount", { count: wins }),
                    rate,
                  })}
                  className="flex-row items-center gap-3"
                >
                  <PlayerAvatar player={player} size={40} />
                  <View className="flex-1">
                    <Text className="font-bold text-[15px] text-foreground">{shortNameOf(player)}</Text>
                    <Text className="font-normal text-[12px] text-muted">
                      {t("profile.matchesCount", { count: matches })} · {t("profile.winsCount", { count: wins })}
                    </Text>
                  </View>
                  <Text className="font-black text-[15px] text-accent-text">{rate}%</Text>
                </PressableFeedback>
              );
            })}
          </Card>
          ) : null}

          <Card className="gap-2.5">
            <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
              {t("playerSheet.whatPlayersSay")}
            </Text>
            {tags.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {tags.map((item) => (
                  <Text
                    key={item.tag}
                    className="overflow-hidden rounded-[14px] bg-primary-soft px-3 py-[7px] font-bold text-[13px] text-primary-dark"
                  >
                    {t(`playerTags.${item.tag}`)} · {item.count}
                  </Text>
                ))}
              </View>
            ) : (
              <Text className="font-normal text-[14px] leading-[20px] text-muted">{t("profile.tagsEmpty")}</Text>
            )}
          </Card>
          </Fragment>
        ) : null}

        <Card className="gap-0 py-0">
          {links.map((link, index) => (
            <PressableFeedback
              key={link.label}
              accessibilityRole="button"
              onPress={link.onPress}
              accessibilityLabel={link.value ? `${link.label}, ${link.value}` : link.label}
              className={cn(
                "h-[50px] flex-row items-center justify-between",
                index < links.length - 1 && "border-b border-fill",
              )}
            >
              <Text className="font-bold text-[15px] text-foreground">{link.label}</Text>
              <View className="flex-row items-center gap-1.5">
                {link.value ? (
                  <Text className="font-normal text-[13px] text-muted">{link.value}</Text>
                ) : null}
                <Icon as={ChevronRight} size={18} color="muted-icon" />
              </View>
            </PressableFeedback>
          ))}
        </Card>

        <View className="mx-4">
          <Button size="lg" variant="outline" onPress={logOut}>
            <Icon as={LogOut} size={20} color="foreground" />
            <Button.Label className="text-foreground">{t("settings.logOut")}</Button.Label>
          </Button>
        </View>
      </Page.Body>

      <ShareProfileSheet
        isOpen={isShareOpen}
        onOpenChange={setIsShareOpen}
      />
    </Page>
  );
}

/** White profile section card, inset 16 px from the screen edges as in the design */
function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <View className={cn("mx-4 gap-3 rounded-[22px] border border-line bg-surface p-4", className)}>
      {children}
    </View>
  );
}
