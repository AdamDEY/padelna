import { Avatar, cn } from "heroui-native";
import { Text } from "react-native";

import type { Player } from "@/types/player";

// The five avatar tints from design.md (background / text)
const tints = [
  { bg: "bg-avatar-blue", fg: "text-avatar-blue-foreground" },
  { bg: "bg-avatar-peach", fg: "text-avatar-peach-foreground" },
  { bg: "bg-avatar-mint", fg: "text-avatar-mint-foreground" },
  { bg: "bg-avatar-lilac", fg: "text-avatar-lilac-foreground" },
  { bg: "bg-avatar-sand", fg: "text-avatar-sand-foreground" },
] as const;

/** Same player, same tint, on every screen */
function tintIndexFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const RING_WIDTH = 2;

export function initialsOf(player: Player) {
  return `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`.toUpperCase();
}

type PlayerAvatarProps = {
  player: Player;
  /** Diameter of the face in px: 28–36 in lists and stacks, 40–52 in rows, 60–92 on profiles */
  size?: number;
  /**
   * Position in a stack. Stacks rotate the tints so neighbours never share a colour;
   * on its own an avatar keeps the tint derived from the player's id.
   */
  stackIndex?: number;
  /** 2 px ring outside the face, in the colour behind the avatar (e.g. "border-accent") */
  ringClassName?: string;
  className?: string;
};

/** Player photo with an initials fallback on one of the design.md avatar tints. */
export function PlayerAvatar({
  player,
  size = 36,
  stackIndex,
  ringClassName,
  className,
}: PlayerAvatarProps) {
  const tint = tints[(stackIndex ?? tintIndexFor(player.id)) % tints.length];
  const outer = ringClassName ? size + RING_WIDTH * 2 : size;

  return (
    <Avatar
      alt={`${player.firstName} ${player.lastName}`}
      className={cn(ringClassName && "border-2", ringClassName, className)}
      style={{ width: outer, height: outer }}
    >
      <Avatar.Fallback className={tint.bg}>
        <Text className={cn("font-bold", tint.fg)} style={{ fontSize: Math.round(size * 0.35) }}>
          {initialsOf(player)}
        </Text>
      </Avatar.Fallback>
    </Avatar>
  );
}
