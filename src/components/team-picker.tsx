import { cn, PressableFeedback } from "heroui-native";
import { Check, Plus } from "lucide-react-native";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
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

/** Players on the app other than you; the host's guests have no profile to show */
export function isOpenable(player: Player, myId?: string) {
  return !player.id.startsWith("guest-") && player.id !== myId;
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
  /** Tapping a player opens their profile; guests and `myId` aren't tappable */
  onPlayerPress?: (player: Player) => void;
  /** Your seat shows "You" with a ring */
  myId?: string;
};

/**
 * Two teams of two facing each other, the line-up on every match screen. With `onSelectSeat`
 * the dashed open seats can be picked (design: Match detail · choose a spot); without it they
 * just read "Open" (design: Your match · hosting · v2).
 */
export function TeamPicker({
  seats,
  selectedSeat,
  me,
  onSelectSeat,
  preferredSide,
  onPlayerPress,
  myId,
}: TeamPickerProps) {
  const { t } = useTranslation();
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
                accessibilityLabel={t("team.versus")}
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
                {t("team.name", { team: teamIndex === 0 ? "A" : "B" })}
              </Text>
              <View className="flex-row justify-around self-stretch">
                {team.map((player, index) => {
                  const seat = teamIndex * half + index + 1;
                  const { side } = seatInfo(seat, seats.length);
                  const sideLabel = t(side === "left" ? "side.left" : "side.right");
                  const isMine = seat === selectedSeat;

                  if (isMine && me) {
                    return <MySeat key={seat} me={me} sideLabel={sideLabel} isPicked />;
                  }
                  if (player && player.id === myId) {
                    return <MySeat key={seat} me={player} sideLabel={sideLabel} />;
                  }
                  if (player) {
                    return (
                      <FilledSeat
                        key={seat}
                        player={player}
                        sideLabel={sideLabel}
                        onPress={
                          onPlayerPress && isOpenable(player, myId)
                            ? () => onPlayerPress(player)
                            : undefined
                        }
                      />
                    );
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

function FilledSeat({
  player,
  sideLabel,
  onPress,
}: {
  player: Player;
  sideLabel: string;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const level = player.level?.toFixed(1);

  return (
    <PressableFeedback
      isDisabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityHint={onPress ? t("team.showsProfile") : undefined}
      accessibilityLabel={`${player.firstName}, ${t("team.sideA11y", { side: sideLabel.toLowerCase() })}${level ? `, ${t("team.levelA11y", { level })}` : ""}`}
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
    </PressableFeedback>
  );
}

/** Your seat: your avatar with a ring, plus a tick while you're picking it and haven't joined yet. */
function MySeat({ me, sideLabel, isPicked = false }: { me: Player; sideLabel: string; isPicked?: boolean }) {
  const { t } = useTranslation();
  const level = me.level?.toFixed(1);

  return (
    <View
      accessible
      accessibilityLabel={`${t("team.you")}, ${t("team.sideA11y", { side: sideLabel.toLowerCase() })}${level ? `, ${t("team.levelA11y", { level })}` : ""}${isPicked ? `, ${t("team.selected")}` : ""}`}
      className="w-[70px] items-center gap-[3px]"
    >
      <View>
        <PlayerAvatar player={me} size={AVATAR_SIZE - 4} ringClassName="border-accent" />
        {isPicked ? (
          <View className="absolute -bottom-1 -end-1 size-[22px] items-center justify-center rounded-full border-2 border-surface bg-accent">
            <Icon as={Check} size={12} color="accent-foreground" />
          </View>
        ) : null}
      </View>
      <Text className="font-black text-[13px] text-accent">{t("team.you")}</Text>
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
  const { t } = useTranslation();

  return (
    <View className="w-[70px] items-center gap-[3px]">
      <View>
        <PressableFeedback
          onPress={onPress}
          isDisabled={!onPress}
          accessibilityRole="button"
          accessibilityLabel={t(onPress ? "team.takeSpot" : "team.openSpot", { side: sideLabel.toLowerCase(), team })}
          className="items-center justify-center rounded-full border-2 border-dashed border-accent bg-surface"
          style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
        >
          <Icon as={Plus} size={20} color="accent" />
        </PressableFeedback>
        {onPress && isYourSide ? (
          <Text className="absolute -top-[9px] self-center overflow-hidden rounded-[7px] bg-lime-soft px-1.5 py-px font-bold text-[10px] text-lime-foreground">
            {t("team.yourSide")}
          </Text>
        ) : null}
      </View>
      <Text className="font-bold text-[13px] text-accent">{onPress ? t("team.tapToJoin") : t("team.open")}</Text>
      <Text className="font-normal text-[11px] text-muted">{sideLabel}</Text>
    </View>
  );
}
