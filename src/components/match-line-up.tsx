import { cn, PressableFeedback } from "heroui-native";
import { Plus, ShieldCheck } from "lucide-react-native";
import { Fragment } from "react";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import type { Player } from "@/types/player";

const AVATAR_SIZE = 52;

type MatchLineUpProps = {
  /** In seat order (seats 1–2 are one team, 3–4 the other); an undefined entry is an open seat */
  players: (Player | undefined)[];
  capacity: number;
  /** Players whose level is still settling, shown as "new" */
  newPlayerIds: Set<string>;
  /** Tapping an open seat, with its number (1–4) */
  onTakeSpot?: (seat: number) => void;
  /** Text under an open seat; the host's own view says "Open" instead of "You?" */
  openSeatLabel?: string;
  /** Tapping a player opens their profile; guests and `myId` aren't tappable */
  onPlayerPress?: (player: Player) => void;
  myId?: string;
};

/** Two teams facing each other, with dashed "You?" seats for open spots. */
export function MatchLineUp({
  players,
  capacity,
  newPlayerIds,
  onTakeSpot,
  openSeatLabel = "You?",
  onPlayerPress,
  myId,
}: MatchLineUpProps) {
  const seats = Array.from({ length: capacity }, (_, i) => players[i]);
  const half = Math.ceil(capacity / 2);
  const teams = [seats.slice(0, half), seats.slice(half)];

  return (
    <View className="flex-row items-center gap-2.5 rounded-[20px] bg-background px-2.5 py-3.5">
      {teams.map((team, teamIndex) => (
        <Fragment key={teamIndex}>
          {teamIndex > 0 ? (
            <Text className="font-black text-[13px] text-muted" accessibilityLabel="versus">
              VS
            </Text>
          ) : null}
          <View className="flex-1 flex-row justify-around">
            {team.map((player, seatIndex) =>
              player ? (
                <Seat
                  key={player.id}
                  player={player}
                  isNew={newPlayerIds.has(player.id)}
                  onPress={
                    onPlayerPress && isOpenable(player, myId) ? () => onPlayerPress(player) : undefined
                  }
                />
              ) : (
                <OpenSeat
                  key={`open-${seatIndex}`}
                  // Even seats are on the left of the court, odd on the right
                  side={seatIndex % 2 === 0 ? "Left side" : "Right side"}
                  label={openSeatLabel}
                  onPress={onTakeSpot ? () => onTakeSpot(teamIndex * half + seatIndex + 1) : undefined}
                />
              ),
            )}
          </View>
        </Fragment>
      ))}
    </View>
  );
}

/** Players on the app other than you; the host's guests have no profile to show */
export function isOpenable(player: Player, myId?: string) {
  return !player.id.startsWith("guest-") && player.id !== myId;
}

function Seat({ player, isNew, onPress }: { player: Player; isNew: boolean; onPress?: () => void }) {
  const level = player.level?.toFixed(1);

  return (
    <PressableFeedback
      isDisabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityHint={onPress ? "Shows their profile" : undefined}
      accessibilityLabel={`${player.firstName}${level ? `, level ${level}` : ""}${isNew ? ", new player" : ""}`}
      className="items-center gap-1"
    >
      <PlayerAvatar player={player} size={AVATAR_SIZE} />
      <Text numberOfLines={1} className="font-bold text-[13px] text-foreground">
        {player.firstName}
      </Text>
      {level ? (
        isNew ? (
          <Text className="font-semibold text-[12px] text-muted">{level} · new</Text>
        ) : (
          <View className="flex-row items-center gap-0.5">
            <Icon as={ShieldCheck} size={12} color="success" />
            <Text className="font-bold text-[12px] text-success">{level}</Text>
          </View>
        )
      ) : null}
    </PressableFeedback>
  );
}

function OpenSeat({ side, label, onPress }: { side: string; label: string; onPress?: () => void }) {
  return (
    <View className="items-center gap-1">
      <PressableFeedback
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${onPress ? "Take this spot" : "Open spot"}, ${side.toLowerCase()}`}
        className={cn(
          "items-center justify-center rounded-full border-2 border-dashed border-accent bg-surface",
        )}
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
      >
        <Icon as={Plus} size={20} color="accent" />
      </PressableFeedback>
      <Text className="font-bold text-[13px] text-accent">{label}</Text>
      <Text className="font-normal text-[12px] text-muted">{side}</Text>
    </View>
  );
}
