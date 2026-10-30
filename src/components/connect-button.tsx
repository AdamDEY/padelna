import { Button, cn, useToast } from "heroui-native";
import { Check, Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { useRequestConnection, useRespondToConnection } from "@/hooks/usePlayers";
import type { PlayerSuggestion } from "@/types/player";

const sizes = {
  // design: 28 px pills under the "You played with" faces
  sm: { box: "h-7 rounded-[10px] px-2.5", text: "text-[12px]", icon: 0, hitSlop: 8 },
  // design: 34 px buttons at the end of a player row
  md: { box: "h-[34px] rounded-xl px-3", text: "text-[13px]", icon: 14, hitSlop: 5 },
  // design: 52 px blue button in the player sheet
  lg: { box: "h-[52px] rounded-2xl px-4", text: "text-[16px]", icon: 18, hitSlop: 0 },
} as const;

type ConnectButtonProps = {
  player: PlayerSuggestion;
  size?: keyof typeof sizes;
};

/**
 * Connect / Pending / Accept / Connected for one player. Connect is the light blue
 * secondary button, as everywhere in the app (the large one in the player sheet is blue, as designed); Accept answers a request they sent you.
 */
export function ConnectButton({ player, size = "md" }: ConnectButtonProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const requestConnection = useRequestConnection();
  const respondToConnection = useRespondToConnection();
  const style = sizes[size];
  const stateBox = size === "lg" ? "w-full" : "";
  const isBusy = requestConnection.isPending || respondToConnection.isPending;

  function showError(error: Error) {
    toast.show({ variant: "danger", label: t("connect.failed"), description: error.message });
  }

  if (player.connection === "connected" || player.connection === "sent") {
    const isConnected = player.connection === "connected";
    return (
      <View
        accessible
        accessibilityLabel={
          isConnected
            ? t("connect.connectedWith", { name: player.firstName })
            : t("connect.requestSentTo", { name: player.firstName })
        }
        className={cn(
          "flex-row items-center justify-center gap-1 border",
          style.box,
          stateBox,
          isConnected ? "border-success-soft bg-success-soft" : "border-line-input bg-surface",
        )}
      >
        {/* The small tiles have no room for an icon */}
        {style.icon > 0 ? (
          <Icon as={isConnected ? Check : Clock} size={style.icon} color={isConnected ? "success" : "muted"} />
        ) : null}
        <Text className={cn("font-bold", style.text, isConnected ? "text-success" : "text-muted")}>
          {isConnected ? t("connect.connected") : t("connect.pending")}
        </Text>
      </View>
    );
  }

  const isReceived = player.connection === "received";
  return (
    <Button
      variant={size === "lg" ? "primary" : "secondary"}
      size="sm"
      isDisabled={isBusy}
      hitSlop={style.hitSlop}
      accessibilityLabel={
        isReceived
          ? t("connections.acceptA11y", { name: player.firstName })
          : t("connect.connectWith", { name: player.firstName })
      }
      onPress={() =>
        isReceived
          ? respondToConnection.mutate(
              { playerId: player.id, accept: true },
              {
                onSuccess: () => toast.show({ variant: "success", label: t("connections.connected", { name: player.firstName }) }),
                onError: showError,
              },
            )
          : requestConnection.mutate(player.id, {
              onSuccess: () => toast.show({ label: t("connect.requestSentTo", { name: player.firstName }) }),
              onError: showError,
            })
      }
      className={cn("min-w-0", style.box, size === "lg" && "w-full")}
    >
      <Button.Label className={style.text}>{isReceived ? t("connections.accept") : t("connect.connect")}</Button.Label>
    </Button>
  );
}
