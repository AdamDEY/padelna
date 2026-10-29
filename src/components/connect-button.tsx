import { Button, cn, useToast } from "heroui-native";
import { Check, Clock } from "lucide-react-native";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { useRequestConnection, useRespondToConnection } from "@/hooks/usePlayers";
import type { PlayerSuggestion } from "@/types/player";

const sizes = {
  // design: 28 px pills under the "You played with" faces
  sm: { box: "h-7 rounded-[10px] px-2.5", text: "text-[12px]", icon: 0, hitSlop: 8 },
  // design: 34 px buttons at the end of a player row
  md: { box: "h-[34px] rounded-xl px-3", text: "text-[13px]", icon: 14, hitSlop: 5 },
} as const;

type ConnectButtonProps = {
  player: PlayerSuggestion;
  size?: keyof typeof sizes;
};

/**
 * Connect / Pending / Accept / Connected for one player. Connect is the light blue
 * secondary button, as everywhere in the app; Accept answers a request they sent you.
 */
export function ConnectButton({ player, size = "md" }: ConnectButtonProps) {
  const { toast } = useToast();
  const requestConnection = useRequestConnection();
  const respondToConnection = useRespondToConnection();
  const style = sizes[size];
  const isBusy = requestConnection.isPending || respondToConnection.isPending;

  function showError(error: Error) {
    toast.show({ variant: "danger", label: "Couldn’t connect", description: error.message });
  }

  if (player.connection === "connected" || player.connection === "sent") {
    const isConnected = player.connection === "connected";
    return (
      <View
        accessible
        accessibilityLabel={
          isConnected ? `Connected with ${player.firstName}` : `Request sent to ${player.firstName}`
        }
        className={cn(
          "flex-row items-center justify-center gap-1 border",
          style.box,
          isConnected ? "border-success-soft bg-success-soft" : "border-line-input bg-surface",
        )}
      >
        {/* The small tiles have no room for an icon */}
        {style.icon > 0 ? (
          <Icon as={isConnected ? Check : Clock} size={style.icon} color={isConnected ? "success" : "muted"} />
        ) : null}
        <Text className={cn("font-bold", style.text, isConnected ? "text-success" : "text-muted")}>
          {isConnected ? "Connected" : "Pending"}
        </Text>
      </View>
    );
  }

  const isReceived = player.connection === "received";
  return (
    <Button
      variant="secondary"
      size="sm"
      isDisabled={isBusy}
      hitSlop={style.hitSlop}
      accessibilityLabel={
        isReceived ? `Accept ${player.firstName}’s request` : `Connect with ${player.firstName}`
      }
      onPress={() =>
        isReceived
          ? respondToConnection.mutate(
              { playerId: player.id, accept: true },
              {
                onSuccess: () => toast.show({ variant: "success", label: `You’re connected with ${player.firstName}` }),
                onError: showError,
              },
            )
          : requestConnection.mutate(player.id, {
              onSuccess: () => toast.show({ label: `Request sent to ${player.firstName}` }),
              onError: showError,
            })
      }
      className={cn("min-w-0", style.box)}
    >
      <Button.Label className={style.text}>{isReceived ? "Accept" : "Connect"}</Button.Label>
    </Button>
  );
}
