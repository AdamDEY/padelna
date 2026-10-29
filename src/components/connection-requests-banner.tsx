import { Button } from "heroui-native";
import { Text, View } from "react-native";

import { PlayerAvatar, stackTintIndices } from "@/components/player-avatar";
import type { Player } from "@/types/player";

// The banner shows the first faces only
const MAX_FACES = 2;
// The blue avatar tint is the banner's own colour, so those faces would vanish
const BLUE_TINT = 0;

type ConnectionRequestsBannerProps = {
  requesters: Player[];
  onReview: () => void;
};

/** Light blue "2 connection requests · Review" strip at the top of Players. */
export function ConnectionRequestsBanner({ requesters, onReview }: ConnectionRequestsBannerProps) {
  const faces = requesters.slice(0, MAX_FACES);
  const tints = stackTintIndices(faces).reduce<number[]>((result, tint) => {
    const previous = result[result.length - 1];
    result.push(tint !== BLUE_TINT ? tint : previous === 1 ? 2 : 1);
    return result;
  }, []);
  const count = requesters.length;

  return (
    <View className="flex-row items-center gap-2.5 rounded-2xl bg-primary-soft py-2 pe-2 ps-3">
      <View className="flex-row">
        {faces.map((player, index) => (
          <PlayerAvatar
            key={player.id}
            player={player}
            size={30}
            tintIndex={tints[index]}
            ringClassName="border-primary-soft"
            className={index > 0 ? "-ms-2" : undefined}
          />
        ))}
      </View>
      <Text className="flex-1 font-bold text-[14px] text-primary-dark">
        {count} connection {count === 1 ? "request" : "requests"}
      </Text>
      <Button size="sm" onPress={onReview} hitSlop={5} className="h-[34px] rounded-xl px-3.5">
        <Button.Label className="text-[13px]">Review</Button.Label>
      </Button>
    </View>
  );
}
