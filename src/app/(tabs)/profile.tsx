import { router, useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { Button, cn, PressableFeedback, Spinner, useToast } from "heroui-native";
import { ChevronRight } from "lucide-react-native";
import { Fragment, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { NewPlayerCards } from "@/components/new-player-cards";
import { LevelChart } from "@/components/level-chart";
import { Page } from "@/components/page";
import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { translateLabel } from "@/i18n";
import { ProfileHero } from "@/components/profile-hero";
import { WinRateBars } from "@/components/win-rate-bars";
import { useMatchHistory, useMyPastMatches } from "@/hooks/useMatches";
import { useMyProfile } from "@/hooks/useMyProfile";
import { usePlayerDetails } from "@/hooks/usePlayers";

export default function Profile() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: profile, error, refetch, isRefetching } = useMyProfile();
  const { data: pastMatches } = useMyPastMatches();
  const { data: history } = useMatchHistory();
  // The profile's own friend count is mock, so ask for the real one
  const friendCount = usePlayerDetails(profile?.player.id).data?.friendCount ?? 0;

  const insets = useSafeAreaInsets();
  // White status bar text while the blue header is behind it; dark once it scrolls away
  const heroHeight = useRef(0);
  const statusBarOverHero = useRef(true);
  // The loading and error states have no blue header, so the status bar stays dark there
  const hasHero = profile !== undefined;

  const applyStatusBar = useCallback(() => {
    setStatusBarStyle(hasHero && statusBarOverHero.current ? "light" : "dark");
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
      return () => setStatusBarStyle("dark");
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
              <Text className="text-center font-normal text-[14px] text-muted">{error.message}</Text>
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

  const first = profile.levelHistory[0];
  const latest = profile.levelHistory[profile.levelHistory.length - 1];
  const levelChange = latest && first ? latest.level - first.level : 0;

  // The profile's numbers are still mock, so "played" comes from the real past matches.
  // Win rates, partners and reputation only make sense once one has been played.
  const hasStats = pastMatches !== undefined && pastMatches.length > 0;
  const noStats = pastMatches !== undefined && pastMatches.length === 0;

  const links = [
    {
      label: t("profile.matchHistory"),
      // The history screen counts the real matches; the profile's own number is still mock
      value: t("profile.matchesCount", { count: noStats ? 0 : (history?.length ?? profile.matchesPlayed) }),
      onPress: () =>
        noStats
          ? toast.show({ label: t("profile.historyLockedTitle"), description: t("profile.historyLockedText") })
          : router.push("/match-history"),
    },
    // The design leaves Reviews out until the first one arrives
    ...(noStats ? [] : [{ label: t("profile.reviews"), value: String(profile.reviewCount) }]),
    {
      label: t("profile.friends"),
      // The real count, from your connections; the profile's own number is still mock
      value: String(friendCount),
      onPress: () =>
        friendCount === 0
          ? toast.show({ label: t("friends.lockedTitle"), description: t("friends.lockedText") })
          : router.push("/friends"),
    },
    { label: t("profile.aboutMe") },
  ];

  return (
    <Page underStatusBar>
      <Page.Body className="gap-[18px] px-0" onScrollY={handleScroll}>
        <View onLayout={(event) => (heroHeight.current = event.nativeEvent.layout.height)}>
          <ProfileHero
            profile={profile}
            hasPlayed={!noStats}
            friendCount={friendCount}
            onPressSettings={() => router.push("/settings")}
          />
        </View>

        {noStats ? (
          <NewPlayerCards friendCount={friendCount} levelLabel={profile.level.toFixed(1)} />
        ) : (
          <Card>
            <View className="flex-row items-baseline justify-between">
              <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
                {t("profile.levelOverTime")}
              </Text>
              {levelChange > 0 ? (
                <Text className="font-bold text-[13px] text-success">
                  {t("profile.levelUp", {
                    change: levelChange.toFixed(1),
                    count: profile.levelHistory.length,
                  })}
                </Text>
              ) : null}
            </View>
            <LevelChart points={profile.levelHistory} />
          </Card>
        )}

        {hasStats ? (
          <Fragment>
          <Card className="gap-3.5">
            <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
              {t("profile.whereYouWin")}
            </Text>
            <WinRateBars groups={profile.winRates} />
          </Card>

          <Card>
            <View className="flex-row items-baseline justify-between">
              <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
                {t("profile.bestPartners")}
              </Text>
              <Text className="font-normal text-[12px] text-muted">{t("profile.winRateTogether")}</Text>
            </View>
            {profile.bestPartners.map(({ player, matches, wins }) => {
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
                  <Text className="font-black text-[15px] text-accent">{rate}%</Text>
                </PressableFeedback>
              );
            })}
          </Card>

          <Card className="gap-2.5">
            <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
              {t("playerSheet.whatPlayersSay")}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {profile.reputationTags.map((tag) => (
                <Text
                  key={tag.label}
                  className="overflow-hidden rounded-[14px] bg-primary-soft px-3 py-[7px] font-bold text-[13px] text-primary-dark"
                >
                  {translateLabel("tags", tag.label)} · {tag.count}
                </Text>
              ))}
            </View>
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
      </Page.Body>
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
