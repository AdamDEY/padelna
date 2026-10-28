import { cn, PressableFeedback } from "heroui-native";
import { Check, Plus } from "lucide-react-native";
import { Fragment } from "react";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import type { Player } from "@/types/player";

const AVATAR_SIZE = 52;

type Side = "left" | "right";

/** "Team A" for seats 1–2, "Team B" for 3–4; the first seat of a team is the left side */
export function seatInfo(seat: number, capacity = 4) {
  const half = capacity / 2;
  return {
    team: seat <= half ? "A" : "B",
    side: (seat - 1) % half === 0 ? "left" : "right",
  } as const satisfies { team: string; side: Side };
}

type TeamPickerProps = {
  /** One entry per seat, in order; an undefined entry is an open seat */
  seats: (Player | undefined)[];
  /** The seat (1–4) you have picked but not confirmed yet */
  selectedSeat?: number;
  /** You, shown in the picked seat */
  me?: Player;
  /** Taps on open seats; leave out when you can't join (e.g. outside the level range) */
  onSelectSeat?: (seat: number) => void;
  /** Your preferred side, to point out the open seats that match it */
  preferredSide?: "left" | "right" | "both";
};

/** Two teams of two with dashed open seats to pick from (design: Match detail · join). */
export function TeamPicker({ seats, selectedSeat, me, onSelectSeat, preferredSide }: TeamPickerProps) {
  const half = seats.length / 2;
  const teams = [seats.slice(0, half), seats.slice(half)];

  return (
    <View className="flex-row items-stretch gap-1.5">
      {teams.map((team, teamIndex) => {
        const isSelectedTeam =
          selectedSeat !== undefined && Math.ceil(selectedSeat / half) === teamIndex + 1;
        return (
          <Fragment key={teamIndex}>
            {teamIndex > 0 ? (
              <Text
                accessibilityLabel="versus"
                className="self-center font-black text-[12px] text-muted-icon"
              >
                VS
              </Text>
            ) : null}
            <View
              className={cn(
                "flex-1 items-center gap-2 rounded-[18px] border-2 px-1 pb-3 pt-2.5",
                isSelectedTeam ? "border-accent bg-primary-soft" : "border-transparent bg-background",
              )}
            >
              <Text
                className={cn(
                  "font-bold text-[12px] uppercase tracking-[0.6px]",
                  isSelectedTeam ? "text-accent" : "text-muted",
                )}
              >
                Team {teamIndex === 0 ? "A" : "B"}
              </Text>
              <View className="flex-row justify-around self-stretch">
                {team.map((player, index) => {
                  const seat = teamIndex * half + index + 1;
                  const { side } = seatInfo(seat, seats.length);
                  const sideLabel = side === "left" ? "Left" : "Right";
                  const isMine = seat === selectedSeat;

                  if (isMine && me) {
                    return <MySeat key={seat} me={me} sideLabel={sideLabel} />;
                  }
                  if (player) {
                    return <FilledSeat key={seat} player={player} sideLabel={sideLabel} />;
                  }
                  return (
                    <OpenSeat
                      key={seat}
                      team={teamIndex === 0 ? "A" : "B"}
                      sideLabel={sideLabel}
                      isYourSide={preferredSide === side}
                      onPress={onSelectSeat ? () => onSelectSeat(seat) : undefined}
                    />
                  );
                })}
              </View>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

function FilledSeat({ player, sideLabel }: { player: Player; sideLabel: string }) {
  const level = player.level?.toFixed(1);

  return (
    <View
      accessible
      accessibilityLabel={`${player.firstName}, ${sideLabel.toLowerCase()} side${level ? `, level ${level}` : ""}`}
      className="w-[70px] items-center gap-[3px]"
    >
      <PlayerAvatar player={player} size={AVATAR_SIZE} />
      <Text numberOfLines={1} className="font-bold text-[13px] text-foreground">
        {player.firstName}
      </Text>
      <Text className="font-normal text-[11px] text-muted">
        {sideLabel}
        {level ? ` · ${level}` : ""}
      </Text>
    </View>
  );
}

/** The seat you picked: your avatar with a ring and a tick. */
function MySeat({ me, sideLabel }: { me: Player; sideLabel: string }) {
  const level = me.level?.toFixed(1);

  return (
    <View
      accessible
      accessibilityLabel={`You, ${sideLabel.toLowerCase()} side${level ? `, level ${level}` : ""}, selected`}
      className="w-[70px] items-center gap-[3px]"
    >
      <View>
        <PlayerAvatar player={me} size={AVATAR_SIZE - 4} ringClassName="border-accent" />
        <View className="absolute -bottom-1 -end-1 size-[22px] items-center justify-center rounded-full border-2 border-surface bg-accent">
          <Icon as={Check} size={12} color="accent-foreground" />
        </View>
      </View>
      <Text className="font-black text-[13px] text-accent">You</Text>
      <Text className="font-normal text-[11px] text-muted">
        {sideLabel}
        {level ? ` · ${level}` : ""}
      </Text>
    </View>
  );
}

function OpenSeat({
  team,
  sideLabel,
  isYourSide,
  onPress,
}: {
  team: string;
  sideLabel: string;
  isYourSide: boolean;
  onPress?: () => void;
}) {
  return (
    <View className="w-[70px] items-center gap-[3px]">
      <View>
        <PressableFeedback
          onPress={onPress}
          isDisabled={!onPress}
          accessibilityRole="button"
          accessibilityLabel={`Take the ${sideLabel.toLowerCase()} spot in Team ${team}`}
          className="items-center justify-center rounded-full border-2 border-dashed border-accent bg-surface"
          style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
        >
          <Icon as={Plus} size={20} color="accent" />
        </PressableFeedback>
        {onPress && isYourSide ? (
          <Text className="absolute -top-[9px] self-center overflow-hidden rounded-[7px] bg-lime-soft px-1.5 py-px font-bold text-[10px] text-lime-foreground">
            Your side
          </Text>
        ) : null}
      </View>
      <Text className="font-bold text-[13px] text-accent">{onPress ? "Tap to join" : "Open"}</Text>
      <Text className="font-normal text-[11px] text-muted">{sideLabel}</Text>
    </View>
  );
}
