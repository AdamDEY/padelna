import { Button, Chip, PressableFeedback } from "heroui-native";
import { Text, View } from "react-native";

import { PlayerAvatar, stackTintIndices } from "@/components/player-avatar";
import { formatMatchDateTime } from "@/lib/format-date";
import type { UpcomingMatch } from "@/types/match";
import type { Player } from "@/types/player";

type UpcomingMatchCardProps = {
  match: UpcomingMatch;
  /** The signed-in player, to tell hosting from joined */
  me: Player;
  onPress?: () => void;
  onInvite?: () => void;
};

/** A match you host or joined: date, status, place, host and players. */
export function UpcomingMatchCard({ match, me, onPress, onInvite }: UpcomingMatchCardProps) {
  const dateTime = formatMatchDateTime(match.startsAt);
  const spotsLeft = Math.max(match.capacity - match.players.length, 0);
  const isFull = spotsLeft === 0;
  const status = isFull ? "Confirmed" : `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left`;
  const hostLine =
    match.host.id === me.id
      ? "You’re hosting"
      : `Hosted by ${match.host.firstName} ${match.host.lastName.charAt(0)}.`;
  const details = [match.clubName, match.courtName, hostLine].filter(Boolean).join(" · ");
  const tintIndices = stackTintIndices(match.players);

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${dateTime}, ${status}, ${details}`}
    >
      <View className="gap-3 rounded-[20px] border border-line bg-surface p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-black text-[16px] text-foreground">{dateTime}</Text>
          <Chip size="sm" variant="soft" color={isFull ? "success" : "warning"}>
            <Chip.Label>{status}</Chip.Label>
          </Chip>
        </View>
        <Text numberOfLines={1} className="-mt-1.5 font-normal text-[14px] text-muted">
          {details}
        </Text>

        <View className="flex-row items-center justify-between">
          <View className="flex-row">
            {match.players.map((player, index) => (
              <PlayerAvatar
                key={player.id}
                player={player}
                size={32}
                tintIndex={tintIndices[index]}
                ringClassName="border-surface"
                className={index > 0 ? "-ms-2" : undefined}
              />
            ))}
          </View>
          {isFull ? null : (
            <Button
              size="sm"
              variant="secondary"
              onPress={onInvite}
              hitSlop={4}
              className="h-9 rounded-xl px-3.5"
            >
              Invite a friend
            </Button>
          )}
        </View>
      </View>
    </PressableFeedback>
  );
}
