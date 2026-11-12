import { cn, PressableFeedback } from "heroui-native";
import { Check, Clock, Plus } from "lucide-react-native";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import { PopIn } from "@/components/pop-in";
import { useHasMounted } from "@/hooks/useHasMounted";
import type { MatchInvite } from "@/types/match";
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
  /** Open seats read "Tag player", for lining up a match that was already played */
  isTagging?: boolean;
  /** White team cards with a border, for the grey page instead of a white sheet */
  onBackground?: boolean;
  /** Players invited to a seat who haven't answered; the seat shows them as "Invited", not open */
  invites?: MatchInvite[];
  /** Tapping an invited seat, e.g. so the host can take the invitation back */
  onInvitePress?: (invite: MatchInvite) => void;
  /** Open seats read "Invite", for the host adding players to the match */
  isInviting?: boolean;
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
  isTagging = false,
  onBackground = false,
  invites = [],
  onInvitePress,
  isInviting = false,
}: TeamPickerProps) {
  const { t } = useTranslation();
  // Seats already filled when the screen opens stay still; one that fills afterwards pops in
  const hasMounted = useHasMounted();
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
                isSelectedTeam
                  ? "border-accent bg-primary-soft"
                  : onBackground
                    ? "border border-line bg-surface"
                    : "border-transparent bg-background",
              )}
            >
              <Text
                className={cn(
                  "font-bold text-[12px] uppercase tracking-[0.6px]",
                  isSelectedTeam ? "text-accent-text" : "text-muted",
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
                    return <MySeat key={seat} me={me} sideLabel={sideLabel} isPicked animate={hasMounted} />;
                  }
                  if (player && player.id === myId) {
                    return <MySeat key={seat} me={player} sideLabel={sideLabel} animate={hasMounted} />;
                  }
                  if (player) {
                    return (
                      <FilledSeat
                        key={seat}
                        player={player}
                        sideLabel={sideLabel}
                        animate={hasMounted}
                        onPress={
                          onPlayerPress && isOpenable(player, myId)
                            ? () => onPlayerPress(player)
                            : undefined
                        }
                      />
                    );
                  }
                  const invite = invites.find((item) => item.seat === seat);
                  if (invite) {
                    return (
                      <InvitedSeat
                        key={seat}
                        invite={invite}
                        sideLabel={sideLabel}
                        isMine={invite.player.id === myId}
                        animate={hasMounted}
                        onPress={onInvitePress ? () => onInvitePress(invite) : undefined}
                      />
                    );
                  }
                  return (
                    <OpenSeat
                      key={seat}
                      team={teamIndex === 0 ? "A" : "B"}
                      sideLabel={sideLabel}
                      isYourSide={preferredSide === side}
                      isTagging={isTagging}
                      isInviting={isInviting}
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
  animate,
}: {
  player: Player;
  sideLabel: string;
  onPress?: () => void;
  animate: boolean;
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
      <PopIn animate={animate}>
        <PlayerAvatar player={player} size={AVATAR_SIZE} />
      </PopIn>
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
function MySeat({
  me,
  sideLabel,
  isPicked = false,
  animate,
}: {
  me: Player;
  sideLabel: string;
  isPicked?: boolean;
  animate: boolean;
}) {
  const { t } = useTranslation();
  const level = me.level?.toFixed(1);

  return (
    <View
      accessible
      accessibilityLabel={`${t("team.you")}, ${t("team.sideA11y", { side: sideLabel.toLowerCase() })}${level ? `, ${t("team.levelA11y", { level })}` : ""}${isPicked ? `, ${t("team.selected")}` : ""}`}
      className="w-[70px] items-center gap-[3px]"
    >
      <PopIn animate={animate}>
        <PlayerAvatar player={me} size={AVATAR_SIZE - 4} ringClassName="border-accent" />
        {isPicked ? (
          <View className="absolute -bottom-1 -end-1 size-[22px] items-center justify-center rounded-full border-2 border-surface bg-accent">
            <Icon as={Check} size={12} color="accent-foreground" />
          </View>
        ) : null}
      </PopIn>
      <Text className="font-black text-[13px] text-accent-text">{t("team.you")}</Text>
      <Text className="font-normal text-[11px] text-muted">
        {sideLabel}
        {level ? ` · ${level}` : ""}
      </Text>
    </View>
  );
}

/** A seat held for a player who hasn't answered yet: a faded avatar with a clock, never open. */
function InvitedSeat({
  invite,
  sideLabel,
  isMine,
  onPress,
  animate,
}: {
  invite: MatchInvite;
  sideLabel: string;
  isMine: boolean;
  onPress?: () => void;
  animate: boolean;
}) {
  const { t } = useTranslation();
  const { player } = invite;
  const name = isMine ? t("team.you") : player.firstName;

  return (
    <PressableFeedback
      isDisabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${name}, ${t("team.invitedA11y")}, ${t("team.sideA11y", { side: sideLabel.toLowerCase() })}`}
      accessibilityHint={onPress ? t("team.invitedHint") : undefined}
      className="w-[70px] items-center gap-[3px]"
    >
      <PopIn animate={animate}>
        <View className="opacity-60">
          <PlayerAvatar
            player={player}
            size={AVATAR_SIZE - (isMine ? 4 : 0)}
            ringClassName={isMine ? "border-accent" : undefined}
          />
        </View>
        {/* The clock is a second signal besides the faded avatar and the "Invited" label */}
        <View className="absolute -bottom-1 -end-1 size-[22px] items-center justify-center rounded-full border-2 border-surface bg-warning-soft">
          <Icon as={Clock} size={12} color="warning" />
        </View>
      </PopIn>
      <Text
        numberOfLines={1}
        className={isMine ? "font-black text-[13px] text-accent-text" : "font-bold text-[13px] text-foreground"}
      >
        {name}
      </Text>
      <Text className="font-bold text-[11px] text-warning">{t("team.invited")}</Text>
    </PressableFeedback>
  );
}

function OpenSeat({
  team,
  sideLabel,
  isYourSide,
  isTagging,
  isInviting,
  onPress,
}: {
  team: string;
  sideLabel: string;
  isYourSide: boolean;
  isTagging: boolean;
  isInviting: boolean;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const label = isTagging
    ? t("team.tagPlayer")
    : isInviting && onPress
      ? t("team.invite")
      : onPress
        ? t("team.tapToJoin")
        : t("team.open");
  const a11yKey = isTagging
    ? "team.tagSpot"
    : isInviting && onPress
      ? "team.inviteSpot"
      : onPress
        ? "team.takeSpot"
        : "team.openSpot";

  return (
    <View className="w-[70px] items-center gap-[3px]">
      <View>
        <PressableFeedback
          onPress={onPress}
          isDisabled={!onPress}
          accessibilityRole="button"
          accessibilityLabel={t(a11yKey, { side: sideLabel.toLowerCase(), team })}
          className="items-center justify-center rounded-full border-2 border-dashed border-accent bg-surface"
          style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
        >
          <Icon as={Plus} size={20} color="accent-text" />
        </PressableFeedback>
        {onPress && isYourSide ? (
          <Text className="absolute -top-[9px] self-center overflow-hidden rounded-[7px] bg-lime-soft px-1.5 py-px font-bold text-[10px] text-lime-foreground">
            {t("team.yourSide")}
          </Text>
        ) : null}
      </View>
      <Text numberOfLines={1} className="font-bold text-[13px] text-accent-text">
        {label}
      </Text>
      <Text className="font-normal text-[11px] text-muted">{sideLabel}</Text>
    </View>
  );
}
