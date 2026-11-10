import { View } from "react-native";

import { PlayerAvatar } from "@/components/player-avatar";
import { facesOf } from "@/lib/tournament-live";
import type { LiveEntry } from "@/types/tournament";

type TournamentFacesProps = {
  entry: LiveEntry;
  size: number;
  /** Colour of the ring around each face, the colour behind them (e.g. "border-surface") */
  ringClassName: string;
  /** How far the second face tucks under the first, in px */
  overlap?: number;
};

/** A pair's avatars, overlapping (design: podium, standings and share image). */
export function TournamentFaces({ entry, size, ringClassName, overlap = 10 }: TournamentFacesProps) {
  return (
    <View className="flex-row">
      {facesOf(entry).map((player, index) => (
        <View key={player.id} style={index > 0 ? { marginStart: -overlap } : undefined}>
          <PlayerAvatar player={player} size={size} ringClassName={ringClassName} />
        </View>
      ))}
    </View>
  );
}
