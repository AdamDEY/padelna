import { BottomSheet, Button, Chip, cn, SearchField, Spinner, useBottomSheetAwareHandlers, useToast } from "heroui-native";
import { Check, Link2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Share, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

import { Icon } from "@/components/icon";
import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { useMyFriends } from "@/hooks/usePlayers";
import { formatMatchDateTime } from "@/lib/format-date";
import type { UpcomingMatch } from "@/types/match";
import type { Friend } from "@/types/player";
import { errorMessage } from "@/lib/error-message";

type InviteFriendSheetProps = {
  /** The match to invite to; null closes the sheet */
  match: UpcomingMatch | null;
  onClose: () => void;
  /** The signed-in player, to tell the host from a player who joined */
  meId: string;
};

type InviteState = "invited" | "asked";

/**
 * "Invite a friend" to one of your upcoming matches: friends who fit its level first,
 * then the rest (only the host can invite them, so other players ask the host).
 */
export function InviteFriendSheet({ match, onClose, meId }: InviteFriendSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: friends, error } = useMyFriends();
  const [query, setQuery] = useState("");
  // Keyed by match and player, so reopening the same match keeps what you sent
  const [sent, setSent] = useState<Map<string, InviteState>>(() => new Map());

  const isHost = match?.host.id === meId;
  const spotsLeft = match ? Math.max(match.capacity - match.players.length, 0) : 0;
  const dateTime = match ? formatMatchDateTime(match.startsAt) : "";

  const { fits, outside, invitable } = useMemo(() => {
    if (!match || !friends) return { fits: [], outside: [], invitable: 0 };
    const inMatch = new Set(match.players.map((player) => player.id));
    const notInMatch = friends.filter((friend) => !inMatch.has(friend.id));
    const search = query.trim().toLowerCase();
    const found = search
      ? notInMatch.filter((friend) => `${friend.firstName} ${friend.lastName}`.toLowerCase().includes(search))
      : notInMatch;
    // A friend without a level yet isn't held back by the range
    const isInRange = (friend: Friend) =>
      friend.level === undefined || (friend.level >= match.levelMin && friend.level <= match.levelMax);
    return {
      fits: found.filter(isInRange),
      outside: found.filter((friend) => !isInRange(friend)),
      invitable: notInMatch.length,
    };
  }, [match, friends, query]);

  function close() {
    setQuery("");
    onClose();
  }

  function toggle(friend: Friend, state: InviteState) {
    if (!match) return;
    const key = `${match.id}:${friend.id}`;
    const isSent = sent.has(key);
    setSent((current) => {
      const next = new Map(current);
      if (isSent) next.delete(key);
      else next.set(key, state);
      return next;
    });
    if (isSent) return;
    // Nothing is sent yet; the API will notify the friend (or the host, who approves them)
    toast.show(
      state === "invited"
        ? {
            variant: "success",
            label: t("inviteSheet.inviteSent", { name: friend.firstName }),
            description: t("inviteSheet.inviteSentText", { name: friend.firstName }),
          }
        : {
            variant: "success",
            label: t("inviteSheet.askSent", { name: match.host.firstName }),
            description: t("inviteSheet.askSentText", { name: match.host.firstName, friend: friend.firstName }),
          },
    );
  }

  function shareLink() {
    if (!match) return;
    Share.share({
      message: t("matchDetail.shareMessage", {
        title: dateTime,
        club: match.clubName,
        level: t("matchDetail.shareLevel", { min: match.levelMin.toFixed(1), max: match.levelMax.toFixed(1) }),
      }),
    });
  }

  function renderRow(friend: Friend, inRange: boolean) {
    const state = match ? sent.get(`${match.id}:${friend.id}`) : undefined;
    const canInvite = inRange || isHost;
    const detail = state
      ? state === "invited"
        ? t("inviteSheet.waiting")
        : t("inviteSheet.asked", { name: match!.host.firstName })
      : !inRange
        ? isHost
          ? t("inviteSheet.outsideYourRange")
          : t("inviteSheet.hostDecides", { name: match!.host.firstName })
        : friend.matchesTogether > 0
          ? t("inviteSheet.playedTogether", { count: friend.matchesTogether })
          : friend.city;
    return (
      <FriendRow
        key={friend.id}
        friend={friend}
        inRange={inRange}
        detail={detail}
        action={canInvite ? "invite" : "ask"}
        isSent={state !== undefined}
        onPress={() => toggle(friend, canInvite ? "invited" : "asked")}
      />
    );
  }

  return (
    <BottomSheet isOpen={match !== null} onOpenChange={(open) => !open && close()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          contentContainerClassName="gap-3 px-5 pb-[30px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          {match ? (
            <>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-0.5">
                  <BottomSheet.Title className="font-black text-[20px] text-foreground">
                    {t("inviteSheet.title")}
                  </BottomSheet.Title>
                  <BottomSheet.Description className="font-normal text-[13px] text-muted">
                    {[dateTime, match.clubName].filter(Boolean).join(" · ")}
                  </BottomSheet.Description>
                </View>
                <BottomSheet.Close className="size-9 rounded-full bg-background" />
              </View>

              <View className="flex-row gap-1.5">
                <Chip size="sm" variant="soft" color="warning">
                  <Chip.Label>{t("match.spotsLeft", { count: spotsLeft })}</Chip.Label>
                </Chip>
                <Chip size="sm" variant="soft" className="bg-lime-soft">
                  <Chip.Label className="text-lime-foreground">
                    {t("inviteSheet.level", { min: match.levelMin.toFixed(1), max: match.levelMax.toFixed(1) })}
                  </Chip.Label>
                </Chip>
              </View>

              <FriendSearch value={query} onChange={setQuery} />

              {error ? (
                <Text className="font-normal text-[14px] text-muted">
                  {t("inviteSheet.loadFailed", { message: errorMessage(error) })}
                </Text>
              ) : friends === undefined ? (
                <Spinner accessibilityLabel={t("inviteSheet.loading")} className="self-start" />
              ) : invitable === 0 ? (
                <View className="gap-1 rounded-[14px] bg-background px-3.5 py-3">
                  <Text className="font-bold text-[15px] text-foreground">
                    {friends.length === 0 ? t("inviteSheet.noFriends") : t("inviteSheet.allInMatch")}
                  </Text>
                  {friends.length === 0 ? (
                    <Text className="font-normal text-[13px] leading-[19px] text-muted">
                      {t("inviteSheet.noFriendsText")}
                    </Text>
                  ) : null}
                </View>
              ) : fits.length === 0 && outside.length === 0 ? (
                <Text className="py-2 font-normal text-[14px] text-muted">
                  {t("inviteSheet.noResults", { query: query.trim() })}
                </Text>
              ) : (
                <ScrollView className="max-h-[360px]" keyboardShouldPersistTaps="handled">
                  {fits.length > 0 ? <SectionLabel>{t("inviteSheet.fits")}</SectionLabel> : null}
                  {fits.map((friend) => renderRow(friend, true))}
                  {outside.length > 0 ? (
                    <SectionLabel className={fits.length > 0 ? "mt-1.5" : undefined}>
                      {t("inviteSheet.outside")}
                    </SectionLabel>
                  ) : null}
                  {outside.map((friend) => renderRow(friend, false))}
                </ScrollView>
              )}

              <Button
                variant="outline"
                onPress={shareLink}
                className="h-12 rounded-[14px] border-dashed border-primary-outline bg-surface"
              >
                <Icon as={Link2} size={18} color="accent-text" />
                <Button.Label className="text-[15px] text-accent-text">{t("inviteSheet.shareLink")}</Button.Label>
              </Button>

              <Text className="text-center font-normal text-[12px] text-muted">
                {spotsLeft === 1 ? t("inviteSheet.lastSpot") : t("inviteSheet.spots", { count: spotsLeft })}
              </Text>
            </>
          ) : null}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

/** The search box; tells the sheet about the keyboard so it moves above it. */
function FriendSearch({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const { t } = useTranslation();
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();

  return (
    <SearchField value={value} onChange={onChange}>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input
          placeholder={t("inviteSheet.searchPlaceholder")}
          accessibilityLabel={t("inviteSheet.searchA11y")}
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

function SectionLabel({ children, className }: { children: string; className?: string }) {
  return (
    <Text
      accessibilityRole="header"
      className={cn("font-bold text-[12px] uppercase tracking-[0.6px] text-muted", className)}
    >
      {children}
    </Text>
  );
}

type FriendRowProps = {
  friend: Friend;
  /** Lime level chip when the friend fits the match, grey when outside its range */
  inRange: boolean;
  detail?: string;
  /** "ask": only the host can invite this friend, so you ask the host */
  action: "invite" | "ask";
  isSent: boolean;
  onPress: () => void;
};

function FriendRow({ friend, inRange, detail, action, isSent, onPress }: FriendRowProps) {
  const { t } = useTranslation();
  const name = friend.firstName;

  return (
    <View className="flex-row items-center gap-3 py-2">
      <PlayerAvatar player={friend} size={42} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text numberOfLines={1} className="shrink font-bold text-[15px] text-foreground">
            {shortNameOf(friend)}
          </Text>
          {friend.level !== undefined ? (
            <Text
              className={cn(
                "overflow-hidden rounded-[7px] px-1.5 py-px font-black text-[11px]",
                inRange ? "bg-lime-soft text-lime-foreground" : "bg-out-of-range text-muted",
              )}
            >
              {friend.level.toFixed(1)}
            </Text>
          ) : null}
        </View>
        {detail ? (
          <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
            {detail}
          </Text>
        ) : null}
      </View>

      {isSent ? (
        <Button
          size="sm"
          variant="outline"
          onPress={onPress}
          hitSlop={4}
          accessibilityLabel={
            action === "invite"
              ? t("inviteSheet.invitedA11y", { name })
              : t("inviteSheet.askedHostA11y", { name })
          }
          className="h-9 min-w-[92px] rounded-xl border-line-input bg-surface px-2.5"
        >
          <Icon as={Check} size={14} color="success" />
          <Button.Label className="text-[14px] text-success">
            {action === "invite" ? t("inviteSheet.invited") : t("inviteSheet.askedHost")}
          </Button.Label>
        </Button>
      ) : action === "invite" ? (
        <Button
          size="sm"
          onPress={onPress}
          hitSlop={4}
          accessibilityLabel={t("inviteSheet.inviteA11y", { name })}
          className="h-9 min-w-[92px] rounded-xl px-3"
        >
          <Button.Label className="text-[14px]">{t("inviteSheet.invite")}</Button.Label>
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onPress={onPress}
          hitSlop={4}
          accessibilityLabel={t("inviteSheet.askHostA11y", { name })}
          className="h-9 min-w-[92px] rounded-xl border-primary-outline bg-surface px-2.5"
        >
          <Button.Label className="text-[13px] text-accent-text">{t("inviteSheet.askHost")}</Button.Label>
        </Button>
      )}
    </View>
  );
}
