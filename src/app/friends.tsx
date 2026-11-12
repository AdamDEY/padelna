import { router, useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { Button, SearchField, useToast } from "heroui-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChoiceChips } from "@/components/choice-chips";
import { ConnectionRequestsSheet } from "@/components/connection-requests-sheet";
import { FriendRow } from "@/components/friend-row";
import { FriendRowSkeleton } from "@/components/friend-row-skeleton";
import { Page } from "@/components/page";
import { PlayerAvatar, shortNameOf, stackTintIndices } from "@/components/player-avatar";
import { PlayerSheet } from "@/components/player-sheet";
import { FriendsHero } from "@/components/friends-hero";
import { useMyAccount } from "@/hooks/useMyProfile";
import { playersKey, useConnectionRequests, useMyFriends, useRemoveConnection } from "@/hooks/usePlayers";
import { queryClient } from "@/lib/query-client";
import type { Friend } from "@/types/player";
import { errorMessage } from "@/lib/error-message";
import { pageStatusBarStyle } from "@/lib/theme-preference";

type Sort = "played" | "level" | "recent" | "az";

// design: "Your regular partners" shows the three you've played with most
const REGULARS = 3;
// Same rule as a "good fit" elsewhere in the app: within half a level
const SAME_LEVEL = 0.5;

const sorts = [
  { value: "played", label: "friends.sortMostPlayed" },
  { value: "level", label: "friends.sortSameLevel" },
  { value: "recent", label: "friends.sortRecent" },
  { value: "az", label: "friends.sortAZ" },
] as const;

/**
 * My friends, opened from the Profile (design canvas "My friends · from profile"): requests
 * waiting for you, your regular partners, then everyone you're connected to.
 */
export default function Friends() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const { data: account } = useMyAccount();
  const { data: friends, error, refetch, isRefetching } = useMyFriends();
  const { data: requests = [] } = useConnectionRequests();
  const removeConnection = useRemoveConnection();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("played");
  const [isReviewing, setIsReviewing] = useState(false);
  // The friend being removed; only that row slides out
  const [removingId, setRemovingId] = useState<string>();
  const [viewed, setViewed] = useState<Friend>();
  const [isViewing, setIsViewing] = useState(false);

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

  const all = useMemo(() => friends ?? [], [friends]);
  const myLevel = account?.level;
  const sameLevelCount = useMemo(
    () =>
      myLevel === undefined
        ? 0
        : all.filter((friend) => friend.level !== undefined && Math.abs(friend.level - myLevel) <= SAME_LEVEL).length,
    [all, myLevel],
  );
  const regulars = useMemo(
    () => all.filter((friend) => friend.matchesTogether > 0).slice(0, REGULARS),
    [all],
  );

  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    const matching = all.filter(
      (friend) =>
        !text ||
        `${friend.firstName} ${friend.lastName}`.toLowerCase().includes(text),
    );
    const sorted = [...matching];
    if (sort === "played") sorted.sort((a, b) => b.matchesTogether - a.matchesTogether);
    if (sort === "level") {
      const mine = myLevel ?? 0;
      sorted.sort((a, b) => Math.abs((a.level ?? 0) - mine) - Math.abs((b.level ?? 0) - mine));
    }
    if (sort === "recent") sorted.sort((a, b) => b.connectedAt.getTime() - a.connectedAt.getTime());
    if (sort === "az") sorted.sort((a, b) => a.firstName.localeCompare(b.firstName));
    return sorted;
  }, [all, query, sort, myLevel]);

  function open(friend: Friend) {
    setViewed(friend);
    setIsViewing(true);
  }

  function confirmRemove(friend: Friend) {
    Alert.alert(t("connect.removeTitle", { name: friend.firstName }), t("connect.removeText"), [
      { text: t("connect.keep"), style: "cancel" },
      {
        text: t("connect.remove"),
        style: "destructive",
        onPress: () => {
          setRemovingId(friend.id);
          removeConnection.mutate(friend.id, {
            onSuccess: () => toast.show({ label: t("connect.removed", { name: friend.firstName }) }),
            onError: (err) =>
              toast.show({ variant: "danger", label: t("connect.failed"), description: errorMessage(err) }),
            onSettled: () => setRemovingId(undefined),
          });
        },
      },
    ]);
  }

  const regularTints = stackTintIndices(regulars);

  return (
    <Page underStatusBar>
      <Page.Body
        className="gap-4 px-0"
        onScrollY={handleScroll}
        onRefresh={() => queryClient.refetchQueries({ queryKey: playersKey })}
      >
        <View onLayout={(event) => (heroHeight.current = event.nativeEvent.layout.height)}>
          <FriendsHero
            subtitle={
              all.length > 0
                ? t("friends.subtitle", { count: all.length, level: sameLevelCount })
                : t("friends.subtitleNone")
            }
            requests={requests}
            onBack={() => router.back()}
            onReview={() => setIsReviewing(true)}
          />
        </View>

        <View className="gap-3 px-5">
          {error ? (
            <View className="items-start gap-2">
              <Text className="font-normal text-[14px] text-muted">
                {t("friends.loadFailed", { message: errorMessage(error) })}
              </Text>
              <Button size="sm" variant="secondary" onPress={() => refetch()} isDisabled={isRefetching}>
                {t("matches.tryAgain")}
              </Button>
            </View>
          ) : friends === undefined ? (
            <FriendRowSkeleton />
          ) : (
            <>
              <SearchField value={query} onChange={setQuery}>
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input
                    placeholder={t("friends.searchPlaceholder")}
                    accessibilityLabel={t("friends.searchA11y")}
                    autoCorrect={false}
                    returnKeyType="search"
                    className="h-12 rounded-2xl border-line text-[16px]"
                  />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>

              {regulars.length > 0 && !query.trim() ? (
                <View className="gap-2">
                  <Text
                    accessibilityRole="header"
                    className="font-bold text-[12px] uppercase tracking-[0.6px] text-muted"
                  >
                    {t("friends.regulars")}
                  </Text>
                  <View className="flex-row gap-2">
                    {regulars.map((friend, index) => (
                      <Pressable
                        key={friend.id}
                        onPress={() => open(friend)}
                        accessibilityRole="button"
                        accessibilityLabel={`${shortNameOf(friend)}, ${t("friends.together", { count: friend.matchesTogether })}`}
                        className="flex-1 items-center gap-0.5 rounded-[18px] border border-line bg-surface px-1.5 py-3"
                      >
                        <PlayerAvatar player={friend} size={52} tintIndex={regularTints[index]} />
                        <Text numberOfLines={1} className="mt-0.5 font-bold text-[14px] text-foreground">
                          {friend.firstName}
                        </Text>
                        <Text className="font-bold text-[11px] text-accent-text">
                          {t("friends.together", { count: friend.matchesTogether })}
                        </Text>
                      </Pressable>
                    ))}
                    {/* Empty cells keep the faces in their columns when there are fewer than three */}
                    {Array.from({ length: REGULARS - regulars.length }, (_, cell) => (
                      <View key={`empty-${cell}`} className="flex-1" />
                    ))}
                  </View>
                </View>
              ) : null}

              {all.length > 0 ? (
                <ChoiceChips
                  options={sorts.map((item) => ({ value: item.value, label: t(item.label) }))}
                  value={sort}
                  onChange={setSort}
                />
              ) : null}

              {shown.length === 0 ? (
                all.length > 0 ? (
                  <Text className="font-normal text-[14px] text-muted">
                    {t("friends.noMatch", { query: query.trim() })}
                  </Text>
                ) : null
              ) : (
                <View className="rounded-[20px] border border-line bg-surface px-3.5">
                  {shown.map((friend, index) => (
                    <FriendRow
                      key={friend.id}
                      friend={friend}
                      onPress={() => open(friend)}
                      onRemove={() => confirmRemove(friend)}
                      isBusy={removeConnection.isPending}
                      showDivider={index > 0}
                      isRemoving={friend.id === removingId}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </Page.Body>

      <PlayerSheet player={viewed} isOpen={isViewing} onOpenChange={setIsViewing} />
      <ConnectionRequestsSheet requests={requests} isOpen={isReviewing} onOpenChange={setIsReviewing} />
    </Page>
  );
}
