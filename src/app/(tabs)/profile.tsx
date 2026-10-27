import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { cn, PressableFeedback } from "heroui-native";
import { ChevronRight } from "lucide-react-native";
import { useCallback, useRef, type ReactNode } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { LevelChart } from "@/components/level-chart";
import { Page } from "@/components/page";
import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { ProfileHero } from "@/components/profile-hero";
import { WinRateBars } from "@/components/win-rate-bars";
import { myProfile } from "@/data/mock";

export default function Profile() {
  const profile = myProfile;

  const insets = useSafeAreaInsets();
  // White status bar text while the blue header is behind it; dark once it scrolls away
  const heroHeight = useRef(0);
  const statusBarOverHero = useRef(true);

  const applyStatusBar = useCallback(() => {
    setStatusBarStyle(statusBarOverHero.current ? "light" : "dark");
  }, []);

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
  const first = profile.levelHistory[0];
  const latest = profile.levelHistory[profile.levelHistory.length - 1];
  const levelChange = latest && first ? latest.level - first.level : 0;

  const links = [
    { label: "Match history", value: `${profile.matchesPlayed} matches` },
    { label: "Reviews", value: String(profile.reviewCount) },
    { label: "Friends", value: String(profile.friendCount) },
    { label: "About me" },
  ];

  return (
    <Page underStatusBar>
      <Page.Body className="gap-[18px] px-0" onScrollY={handleScroll}>
        <View onLayout={(event) => (heroHeight.current = event.nativeEvent.layout.height)}>
          <ProfileHero profile={profile} />
        </View>

        <Card>
          <View className="flex-row items-baseline justify-between">
            <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
              Your level over time
            </Text>
            {levelChange > 0 ? (
              <Text className="font-bold text-[13px] text-success">
                ▲ {levelChange.toFixed(1)} in {profile.levelHistory.length} months
              </Text>
            ) : null}
          </View>
          <LevelChart points={profile.levelHistory} />
        </Card>

        <Card className="gap-3.5">
          <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
            Where you win
          </Text>
          <WinRateBars groups={profile.winRates} />
        </Card>

        <Card>
          <View className="flex-row items-baseline justify-between">
            <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
              Best partners
            </Text>
            <Text className="font-normal text-[12px] text-muted">Win rate together</Text>
          </View>
          {profile.bestPartners.map(({ player, matches, wins }) => {
            const rate = Math.round((wins / matches) * 100);
            return (
              <PressableFeedback
                key={player.id}
                accessibilityRole="button"
                accessibilityLabel={`${shortNameOf(player)}, ${matches} matches, ${wins} wins, ${rate}% win rate together`}
                className="flex-row items-center gap-3"
              >
                <PlayerAvatar player={player} size={40} />
                <View className="flex-1">
                  <Text className="font-bold text-[15px] text-foreground">{shortNameOf(player)}</Text>
                  <Text className="font-normal text-[12px] text-muted">
                    {matches} matches · {wins} wins
                  </Text>
                </View>
                <Text className="font-black text-[15px] text-accent">{rate}%</Text>
              </PressableFeedback>
            );
          })}
        </Card>

        <Card className="gap-2.5">
          <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
            What players say
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {profile.reputationTags.map((tag) => (
              <Text
                key={tag.label}
                className="overflow-hidden rounded-[14px] bg-primary-soft px-3 py-[7px] font-bold text-[13px] text-primary-dark"
              >
                {tag.label} · {tag.count}
              </Text>
            ))}
          </View>
        </Card>

        <Card className="gap-0 py-0">
          {links.map((link, index) => (
            <PressableFeedback
              key={link.label}
              accessibilityRole="button"
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
