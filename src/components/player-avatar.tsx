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

const RING_WIDTH = 2;

/** Same player, same tint, on every screen */
export function tintIndexFor(player: Player) {
  let hash = 0;
  for (let i = 0; i < player.id.length; i++) {
    hash = (hash * 31 + player.id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % tints.length;
}

/**
 * Tints for an overlapping stack: each player keeps their own tint unless it
 * matches the avatar next to it, then it moves to the next one.
 */
export function stackTintIndices(players: Player[]) {
  const indices: number[] = [];
  for (const player of players) {
    let index = tintIndexFor(player);
    if (indices.length > 0 && index === indices[indices.length - 1]) {
      index = (index + 1) % tints.length;
    }
    indices.push(index);
  }
  return indices;
}

export function initialsOf(player: Player) {
  return `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`.toUpperCase();
}

type PlayerAvatarProps = {
  player: Player;
  /** Diameter of the face in px: 28–36 in lists and stacks, 40–52 in rows, 60–92 on profiles */
  size?: number;
  /** Override the player's tint, e.g. from stackTintIndices() */
  tintIndex?: number;
  /** 2 px ring outside the face, in the colour behind the avatar (e.g. "border-accent") */
  ringClassName?: string;
  className?: string;
};

/** Player photo with an initials fallback on one of the design.md avatar tints. */
export function PlayerAvatar({
  player,
  size = 36,
  tintIndex,
  ringClassName,
  className,
}: PlayerAvatarProps) {
  const tint = tints[tintIndex ?? tintIndexFor(player)];
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
