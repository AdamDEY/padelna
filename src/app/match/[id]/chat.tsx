import { router, useLocalSearchParams } from "expo-router";
import { t } from "i18next";
import { Button, cn, Input, PressableFeedback, Spinner, useToast } from "heroui-native";
import { ArrowUp, Check, Info, Users, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, ScrollView, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { IconButton } from "@/components/icon-button";
import { InfoNote } from "@/components/info-note";
import { Page } from "@/components/page";
import { PlayerAvatar, stackTintIndices, tintTextClassFor } from "@/components/player-avatar";
import { useMarkMatchChatRead, useMatchMessages, useSendMatchMessage } from "@/hooks/useMatchChat";
import { useMatch } from "@/hooks/useMatches";
import { useMyAccount } from "@/hooks/useMyProfile";
import { daysUntil, formatMatchDateTime, formatMatchDay, formatTime, formatWeekday } from "@/lib/format-date";
import type { ChatMessage } from "@/types/chat";
import type { MatchDetails } from "@/types/match";
import type { Player } from "@/types/player";

// Quick replies under the message box (design: Match group chat)
const QUICK_REPLIES = ["chat.onMyWay", "chat.late", "chat.here"] as const;
// Same limit as the database
const MAX_MESSAGE_LENGTH = 1000;

/** A message, or a day label between messages */
type Row =
  | { type: "message"; key: string; message: ChatMessage; isPending?: boolean }
  | { type: "day"; key: string; label: string };

function dayLabel(date: Date) {
  const days = daysUntil(date);
  if (days === 0) return t("time.today");
  if (days === -1) return t("time.yesterday");
  // Within the last week the weekday is enough
  if (days > -7) return formatWeekday(date);
  return formatMatchDay(date);
}

/** Newest first, as the inverted list wants, with a day label above each day's first message */
function toRows(messages: ChatMessage[], pending: ChatMessage[]): Row[] {
  const oldestFirst = [...messages].reverse().concat(pending);
  const pendingIds = new Set(pending.map((message) => message.id));
  const rows: Row[] = [];
  let lastDay = "";
  for (const message of oldestFirst) {
    const day = message.createdAt.toDateString();
    if (day !== lastDay) {
      rows.push({ type: "day", key: `day-${day}`, label: dayLabel(message.createdAt) });
      lastDay = day;
    }
    rows.push({ type: "message", key: message.id, message, isPending: pendingIds.has(message.id) });
  }
  return rows.reverse();
}

function isSameRun(a: Row | undefined, b: ChatMessage) {
  return a?.type === "message" && a.message.kind === "text" && a.message.sender?.id === b.sender?.id;
}

/**
 * The match's group chat (design: Match group chat): the players in the match talk
 * through the details, and the app adds notes when someone joins or leaves, the court
 * is booked or the match is cancelled.
 */
export default function MatchChat() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: match, isPending: isMatchPending } = useMatch(id);
  const { data: account } = useMyAccount();
  const myId = account?.id ?? "";
  const isPlayer = match?.seats?.some((player) => player?.id === myId) ?? false;

  if (isMatchPending || !account) {
    return (
      <Page underStatusBar>
        <Page.Header bar back />
        <Page.Body scroll={false} className="items-center justify-center">
          <Spinner accessibilityLabel={t("chat.loading")} />
        </Page.Body>
      </Page>
    );
  }

  if (!match || !isPlayer) {
    return (
      <Page underStatusBar>
        <Page.Header bar back />
        <Page.Body>
          <InfoNote icon={Users} title={t("chat.notInMatchTitle")}>
            {t("chat.notInMatchText")}
          </InfoNote>
        </Page.Body>
      </Page>
    );
  }

  return (
    <ChatScreen
      match={match}
      me={account.id}
      onSendFailed={(message) =>
        toast.show({ variant: "danger", label: t("chat.sendFailed"), description: message })
      }
    />
  );
}

type ChatScreenProps = {
  match: MatchDetails;
  me: string;
  onSendFailed: (message: string) => void;
};

function ChatScreen({ match, me, onSendFailed }: ChatScreenProps) {
  const { t } = useTranslation();
  const messages = useMatchMessages(match.id);
  const sendMessage = useSendMatchMessage();
  const markRead = useMarkMatchChatRead();
  const [draft, setDraft] = useState("");
  // Shown greyed out until the chat reloads with them
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const nextPendingId = useRef(0);

  const loaded = messages.data?.pages.flat() ?? [];
  const newestId = loaded[0]?.id;
  const markChatRead = markRead.mutate;
  // Everything on screen counts as read, including messages that arrive while it's open
  useEffect(() => {
    markChatRead(match.id);
  }, [markChatRead, match.id, newestId]);

  const tintIndices = stackTintIndices(match.players);
  const place = match.isCourtBooked
    ? [match.clubName, match.courtName].filter(Boolean).join(" · ")
    : t("myMatch.courtNotBookedYet");
  const isCancelled = loaded.some((message) => message.kind === "cancelled");
  const myCard = match.players.find((player) => player.id === me);
  const rows = toRows(loaded, pending);

  /** `fromDraft`: the text came from the message box, which empties while it sends */
  async function send(text: string, fromDraft = false) {
    const body = text.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!body) return;
    const temp: ChatMessage = {
      id: `pending-${nextPendingId.current++}`,
      kind: "text",
      body,
      sender: myCard,
      createdAt: new Date(),
    };
    setPending((current) => [...current, temp]);
    if (fromDraft) setDraft("");
    try {
      await sendMessage.mutateAsync({ matchId: match.id, body });
      await messages.refetch();
    } catch (error) {
      if (fromDraft) setDraft(text);
      onSendFailed((error as Error).message);
    } finally {
      setPending((current) => current.filter((message) => message.id !== temp.id));
    }
  }

  return (
    <Page underStatusBar>
      <Page.Header
        bar
        back
        leading={
          <View className="flex-row items-center gap-2.5">
            <View className="flex-row">
              {match.players.map((player, index) => (
                <PlayerAvatar
                  key={player.id}
                  player={player}
                  size={26}
                  tintIndex={tintIndices[index]}
                  ringClassName="border-surface"
                  className={index > 0 ? "-ms-2.5" : undefined}
                />
              ))}
            </View>
            <View className="flex-1">
              <Text numberOfLines={1} accessibilityRole="header" className="font-black text-[16px] text-foreground">
                {formatMatchDateTime(match.startsAt)}
              </Text>
              <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
                {place} · {t("chat.players", { count: match.players.length })}
              </Text>
            </View>
          </View>
        }
      >
        <IconButton
          icon={Info}
          label={t("chat.details")}
          onPress={() => router.navigate({ pathname: "/match/[id]", params: { id: match.id } })}
        />
      </Page.Header>

      <Page.Body scroll={false} className="px-0">
        {messages.isPending ? (
          <View className="flex-1 items-center justify-center">
            <Spinner accessibilityLabel={t("chat.loading")} />
          </View>
        ) : messages.isError ? (
          <View className="px-4">
            <InfoNote icon={X} tone="warning" title={t("chat.loadFailed")}>
              {messages.error.message}
            </InfoNote>
          </View>
        ) : (
          <FlatList
            inverted
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerClassName="gap-2.5 px-4 py-3.5"
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onEndReached={() => {
              if (messages.hasNextPage && !messages.isFetchingNextPage) messages.fetchNextPage();
            }}
            ListEmptyComponent={
              // Inverted, so flip it back the right way up
              <Text className="-scale-y-100 px-6 text-center font-normal text-[14px] text-muted">
                {t("chat.empty")}
              </Text>
            }
            ListFooterComponent={messages.isFetchingNextPage ? <Spinner className="self-center" /> : undefined}
            renderItem={({ item, index }) => {
              if (item.type === "day") return <DayLabel label={item.label} />;
              const { message } = item;
              if (message.kind !== "text") return <Note message={message} me={me} courtName={match.courtName} />;
              // Inverted: the row above in time is the next index, the one below the previous
              return (
                <MessageBubble
                  message={message}
                  isMine={message.sender?.id === me}
                  isPending={item.isPending}
                  showName={!isSameRun(rows[index + 1], message)}
                  showAvatar={!isSameRun(rows[index - 1], message)}
                />
              );
            }}
          />
        )}
      </Page.Body>

      <Page.Footer className="gap-2.5 border-t border-line bg-surface px-3">
        {isCancelled ? (
          <Text className="py-2 text-center font-normal text-[13px] text-muted">{t("chat.cancelledNote")}</Text>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="gap-2"
            >
              {QUICK_REPLIES.map((key) => (
                <PressableFeedback
                  key={key}
                  onPress={() => send(t(key))}
                  accessibilityRole="button"
                  className="h-[34px] justify-center rounded-full border border-primary-outline bg-surface px-3"
                >
                  <Text className="font-bold text-[13px] text-primary-dark">{t(key)}</Text>
                </PressableFeedback>
              ))}
            </ScrollView>
            <View className="flex-row items-center gap-2">
              <Input
                value={draft}
                onChangeText={setDraft}
                placeholder={t("chat.placeholder")}
                accessibilityLabel={t("chat.message")}
                maxLength={MAX_MESSAGE_LENGTH}
                returnKeyType="send"
                submitBehavior="submit"
                // The event has what's in the box now; `draft` can be a render behind fast typing
                onSubmitEditing={(event) => send(event.nativeEvent.text, true)}
                className="h-11 flex-1 rounded-full bg-background px-4 text-[15px]"
              />
              <Button
                isIconOnly
                accessibilityLabel={t("chat.send")}
                onPress={() => send(draft, true)}
                isDisabled={draft.trim() === ""}
                className="size-11 rounded-full"
              >
                <Icon as={ArrowUp} size={20} color="accent-foreground" />
              </Button>
            </View>
          </>
        )}
      </Page.Footer>
    </Page>
  );
}

function DayLabel({ label }: { label: string }) {
  return (
    <Text className="self-center overflow-hidden rounded-xl bg-track px-3 py-1 font-bold text-[12px] text-muted">
      {label}
    </Text>
  );
}

type NoteProps = {
  message: ChatMessage;
  me: string;
  courtName?: string;
};

/** A line the app adds when something happens to the match. */
function Note({ message, me, courtName }: NoteProps) {
  const { t } = useTranslation();
  const name = !message.sender
    ? t("chat.aPlayer")
    : message.sender.id === me
      ? t("common.you")
      : message.sender.firstName;

  if (message.kind === "court_booked") {
    return (
      <View className="flex-row items-center gap-1.5 self-center rounded-xl bg-success-soft px-3 py-1">
        <Icon as={Check} size={12} color="success" />
        <Text className="font-bold text-[12px] text-success">
          {courtName
            ? t("chat.courtBooked", { name, court: courtName })
            : t("chat.courtBookedNoNumber", { name })}
        </Text>
      </View>
    );
  }

  const text = {
    joined: t("chat.joined", { name }),
    joined_full: t("chat.joinedFull", { name }),
    left: t("chat.left", { name }),
    cancelled: t("chat.cancelled", { name }),
  }[message.kind as "joined" | "joined_full" | "left" | "cancelled"];

  return <Text className="self-center text-center font-bold text-[12px] text-muted">{text}</Text>;
}

type MessageBubbleProps = {
  message: ChatMessage;
  isMine: boolean;
  isPending?: boolean;
  /** First message of a run from the same player */
  showName: boolean;
  /** Last message of a run from the same player */
  showAvatar: boolean;
};

/** A player's message: yours on the right in blue, others on the left with their name. */
function MessageBubble({ message, isMine, isPending, showName, showAvatar }: MessageBubbleProps) {
  const { t } = useTranslation();
  const sender: Player = message.sender ?? { id: "unknown", firstName: t("chat.aPlayer"), lastName: "" };
  const time = formatTime(message.createdAt);

  if (isMine) {
    return (
      <View className="max-w-[78%] items-end gap-0.5 self-end">
        <View
          accessibilityLabel={`${message.body}, ${isPending ? t("chat.sending") : time}`}
          className={cn("rounded-[18px] rounded-ee-[6px] bg-accent px-[13px] py-[9px]", isPending && "opacity-60")}
        >
          <Text className="font-normal text-[15px] leading-[21px] text-accent-foreground">{message.body}</Text>
        </View>
        {showAvatar ? (
          <Text className="font-normal text-[11px] text-muted">{isPending ? t("chat.sending") : time}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="max-w-[80%] flex-row items-end gap-2">
      <View className="size-7">
        {showAvatar ? <PlayerAvatar player={sender} size={28} /> : null}
      </View>
      <View className="shrink gap-0.5">
        {showName ? (
          <Text className={cn("ps-1 font-bold text-[11px]", tintTextClassFor(sender))}>{sender.firstName}</Text>
        ) : null}
        <View
          accessibilityLabel={`${sender.firstName}: ${message.body}, ${time}`}
          className="rounded-[18px] rounded-es-[6px] border border-line bg-surface px-[13px] py-[9px]"
        >
          <Text className="font-normal text-[15px] leading-[21px] text-foreground">{message.body}</Text>
        </View>
      </View>
    </View>
  );
}
