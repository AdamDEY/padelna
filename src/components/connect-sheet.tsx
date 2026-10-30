import { BottomSheet, Button } from "heroui-native";
import { Check, Clock } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { winnerIndex } from "@/components/result-post-card";
import { formatMatchDay } from "@/lib/format-date";
import type { Player } from "@/types/player";
import type { ResultPost } from "@/types/post";

type ConnectSheetProps = {
  /** The match whose players to show; null closes the sheet */
  post: ResultPost | null;
  onClose: () => void;
  /** The signed-in player, left out of the list */
  meId: string;
  friendIds?: Set<string>;
  requestedIds?: Set<string>;
  onToggleRequest?: (playerId: string) => void;
  /** The button for each player; replaces the built-in Connect / Requested / Friends toggle */
  renderAction?: (player: Player) => ReactNode;
};

/**
 * "Players in this match": pick who to connect with from a result card.
 * Each player shows Connect, Requested (tap to cancel) or Friends.
 */
export function ConnectSheet({
  post,
  onClose,
  meId,
  friendIds = new Set(),
  requestedIds = new Set(),
  onToggleRequest,
  renderAction,
}: ConnectSheetProps) {
  const { t } = useTranslation();
  const winner = post ? winnerIndex(post.sets) : 0;
  const sections = post
    ? [
        { label: t("connectSheet.winners"), players: post.teams[winner] },
        { label: t("connectSheet.opponents"), players: post.teams[1 - winner] },
      ]
        .map((section) => ({
          ...section,
          players: section.players.filter(
            (player) => player.id !== meId && !player.id.startsWith("guest-"),
          ),
        }))
        .filter((section) => section.players.length > 0)
    : [];

  return (
    <BottomSheet isOpen={post !== null} onOpenChange={(open) => !open && onClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          contentContainerClassName="gap-3.5 px-5 pb-[34px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          {post ? (
            <>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-0.5">
                  <BottomSheet.Title className="font-black text-[20px] text-foreground">
                    {t("connectSheet.title")}
                  </BottomSheet.Title>
                  <BottomSheet.Description className="font-normal text-[13px] text-muted">
                    {post.clubName} · {formatMatchDay(post.playedAt)}
                  </BottomSheet.Description>
                </View>
                <BottomSheet.Close className="size-9 rounded-full bg-background" />
              </View>

              {sections.map((section, index) => (
                <View key={section.label} className="gap-1">
                  {index > 0 ? <View className="mb-2.5 h-px bg-out-of-range" /> : null}
                  <Text className="font-bold text-[12px] uppercase tracking-[0.6px] text-muted">
                    {section.label}
                  </Text>
                  {section.players.map((player) => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      status={
                        friendIds.has(player.id)
                          ? "friends"
                          : requestedIds.has(player.id)
                            ? "requested"
                            : "none"
                      }
                      onToggleRequest={() => onToggleRequest?.(player.id)}
                      action={renderAction?.(player)}
                    />
                  ))}
                </View>
              ))}

              <Text className="rounded-[14px] bg-background px-3 py-2.5 font-normal text-[13px] leading-[19px] text-muted">
                {/* Real requests can't be cancelled yet; the sample feeds' toggle can */}
                {renderAction
                  ? t("connectSheet.note")
                  : t("connectSheet.noteCancel")}
              </Text>
            </>
          ) : null}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

type ConnectionStatus = "none" | "requested" | "friends";

function PlayerRow({
  player,
  status,
  onToggleRequest,
  action,
}: {
  player: Player;
  status: ConnectionStatus;
  onToggleRequest: () => void;
  action?: ReactNode;
}) {
  const { t } = useTranslation();
  const details = [
    player.level !== undefined ? t("connectSheet.level", { level: player.level.toFixed(1) }) : null,
    player.city,
    player.mutualFriendCount
      ? t("connectSheet.mutual", { count: player.mutualFriendCount })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="flex-row items-center gap-3 py-2">
      <PlayerAvatar player={player} size={46} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-bold text-[15px] text-foreground">
          {shortNameOf(player)}
        </Text>
        {details ? (
          <Text numberOfLines={2} className="font-normal text-[12px] text-muted">
            {details}
          </Text>
        ) : null}
      </View>

      {action ? (
        action
      ) : status === "friends" ? (
        <View
          accessible
          accessibilityLabel={t("connectSheet.alreadyFriends")}
          className="h-9 min-w-24 flex-row items-center justify-center gap-[5px] rounded-xl bg-success-soft px-3"
        >
          <Icon as={Check} size={14} color="success" />
          <Text className="font-bold text-[13px] text-success">{t("connectSheet.friends")}</Text>
        </View>
      ) : (
        <Button
          size="sm"
          variant={status === "requested" ? "outline" : "primary"}
          onPress={onToggleRequest}
          accessibilityLabel={
            status === "requested"
              ? t("connectSheet.requestedA11y", { name: player.firstName })
              : t("connect.connectWith", { name: player.firstName })
          }
          hitSlop={4}
          className="h-9 min-w-24 rounded-xl px-3.5"
        >
          {status === "requested" ? (
            <>
              <Icon as={Clock} size={14} color="muted" />
              <Button.Label className="text-[13px] text-muted">{t("connectSheet.requested")}</Button.Label>
            </>
          ) : (
            <Button.Label className="text-[13px]">{t("connect.connect")}</Button.Label>
          )}
        </Button>
      )}
    </View>
  );
}
