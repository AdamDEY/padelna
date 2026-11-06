import { BottomSheet, Button, cn, SearchField, Spinner, useBottomSheetAwareHandlers } from "heroui-native";
import { Check } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Text, View } from "react-native";
// Gesture Handler's Pressable and ScrollView: React Native's don't get touches inside a sheet
import { Pressable, ScrollView } from "react-native-gesture-handler";

import { Icon } from "@/components/icon";
import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { useMyFriends, usePlayedWith, useSearchPlayers } from "@/hooks/usePlayers";
import { errorMessage } from "@/lib/error-message";
import type { PlayerSuggestion } from "@/types/player";

// Search waits for this many characters, like the database
const MIN_SEARCH_LENGTH = 2;
// Room for about five rows; the rest scrolls
const LIST_MAX_HEIGHT = 330;

type TagPlayerSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** The seat being filled (2 is your partner, 3–4 the other team) */
  seat: number;
  /** Whoever is in that seat now, picked when the sheet opens */
  current?: PlayerSuggestion;
  /** Players already in the other seats, who can't be tagged twice */
  takenIds: string[];
  onTag: (player: PlayerSuggestion) => void;
};

/**
 * "Tag a player" for a match played elsewhere (design: LogMatchTag): people you played with
 * and your friends, or anyone on Padelna by search. Opponents are asked to confirm the score.
 */
export function TagPlayerSheet({ isOpen, onOpenChange, seat, current, takenIds, onTag }: TagPlayerSheetProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PlayerSuggestion | undefined>(current);
  const isSearching = query.trim().length >= MIN_SEARCH_LENGTH;
  const friends = useMyFriends();
  const playedWith = usePlayedWith();
  const search = useSearchPlayers(query);
  const isOpponent = seat > 2;

  // Each time the sheet opens, start from the player in that seat
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setQuery("");
      setPicked(current);
    }
  }

  const sections = useMemo(() => {
    if (isSearching) return [{ title: t("logMatch.results"), players: search.data ?? [] }];
    const friendIds = new Set((friends.data ?? []).map((friend) => friend.id));
    return [
      // Played-with lists people you aren't connected to, so nobody shows twice
      { title: t("logMatch.playedWith"), players: (playedWith.data ?? []).filter((p) => !friendIds.has(p.id)) },
      { title: t("logMatch.yourFriends"), players: friends.data ?? [] },
    ].filter((section) => section.players.length > 0);
  }, [isSearching, search.data, friends.data, playedWith.data, t]);

  const error = isSearching ? search.error : friends.error ?? playedWith.error;
  const isLoading = isSearching ? search.isPending : friends.isPending || playedWith.isPending;

  function handleOpenChange(open: boolean) {
    if (!open) setQuery("");
    onOpenChange(open);
  }

  function pick(player: PlayerSuggestion) {
    setPicked(player);
    // While the search box has focus, the sheet moves when it lets go and the next tap misses
    Keyboard.dismiss();
  }

  function tag() {
    if (!picked) return;
    onTag(picked);
    handleOpenChange(false);
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          contentContainerClassName="gap-3 px-5 pb-[30px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-0.5">
              <BottomSheet.Title className="font-black text-[20px] text-foreground">
                {isOpponent ? t("logMatch.tagOpponent") : t("logMatch.tagPartner")}
              </BottomSheet.Title>
              <BottomSheet.Description className="font-normal text-[13px] text-muted">
                {isOpponent ? t("logMatch.opponentText") : t("logMatch.partnerText")}
              </BottomSheet.Description>
            </View>
            <BottomSheet.Close className="size-9 rounded-full bg-background" />
          </View>

          <PlayerSearch value={query} onChange={setQuery} />

          {error ? (
            <Text className="font-normal text-[14px] text-muted">
              {t("logMatch.loadFailed", { message: errorMessage(error) })}
            </Text>
          ) : isLoading ? (
            <Spinner className="self-start" />
          ) : sections.length === 0 || sections.every((section) => section.players.length === 0) ? (
            <Text className="py-2 font-normal text-[14px] text-muted">
              {isSearching ? t("logMatch.noResults", { query: query.trim() }) : t("logMatch.noSuggestions")}
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: LIST_MAX_HEIGHT }} keyboardShouldPersistTaps="handled">
              {sections.map((section, index) => (
                <View key={section.title}>
                  <Text
                    accessibilityRole="header"
                    className={cn(
                      "mb-1 font-bold text-[12px] uppercase tracking-[0.6px] text-muted",
                      index > 0 && "mt-2.5",
                    )}
                  >
                    {section.title}
                  </Text>
                  {section.players.map((player) => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      isPicked={picked?.id === player.id}
                      isTaken={takenIds.includes(player.id)}
                      onPress={() => pick(player)}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
          )}

          <Button size="lg" isDisabled={!picked} onPress={tag} className="mt-1">
            {picked ? t("logMatch.tagName", { name: shortNameOf(picked) }) : t("logMatch.pickSomeone")}
          </Button>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

/** The search box; tells the sheet about the keyboard so it moves above it. */
function PlayerSearch({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const { t } = useTranslation();
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();

  return (
    <SearchField value={value} onChange={onChange}>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input
          placeholder={t("logMatch.search")}
          accessibilityLabel={t("logMatch.searchA11y")}
          autoCorrect={false}
          returnKeyType="search"
          onFocus={onFocus}
          onBlur={onBlur}
          className="h-11 rounded-[14px] border-0 bg-background text-[15px]"
        />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}

type PlayerRowProps = {
  player: PlayerSuggestion;
  isPicked: boolean;
  /** Already in another seat */
  isTaken: boolean;
  onPress: () => void;
};

/** A player to tag: avatar, name, level and club or city, with a radio circle that ticks. */
function PlayerRow({ player, isPicked, isTaken, onPress }: PlayerRowProps) {
  const { t } = useTranslation();
  const detail = [player.level?.toFixed(1), player.clubName ?? player.city].filter(Boolean).join(" · ");

  return (
    <Pressable
      onPress={onPress}
      disabled={isTaken}
      accessibilityRole="radio"
      accessibilityState={{ selected: isPicked, disabled: isTaken }}
      accessibilityLabel={[shortNameOf(player), detail, isTaken ? t("logMatch.alreadyTagged") : null]
        .filter(Boolean)
        .join(", ")}
    >
      {/* Gesture Handler's Pressable takes no className, so the row is a View inside it */}
      <View
        className={cn(
          "flex-row items-center gap-3 rounded-[14px] px-2.5 py-2",
          isPicked && "bg-primary-soft",
          isTaken && "opacity-50",
        )}
      >
        <PlayerAvatar player={player} size={42} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-bold text-[15px] text-foreground">
            {shortNameOf(player)}
          </Text>
          <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
            {isTaken ? t("logMatch.alreadyTagged") : detail}
          </Text>
        </View>
        {/* The tick is always there and only changes colour: an icon mounted after the
            sheet opened didn't draw on iOS */}
        <View
          className={cn(
            "size-7 items-center justify-center rounded-full border-2",
            isPicked ? "border-accent bg-accent" : "border-primary-outline bg-surface",
          )}
        >
          <Icon as={Check} size={14} color={isPicked ? "accent-foreground" : "surface"} />
        </View>
      </View>
    </Pressable>
  );
}
