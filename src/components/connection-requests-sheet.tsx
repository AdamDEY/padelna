import { BottomSheet, Button, useToast } from "heroui-native";
import { X } from "lucide-react-native";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerSuggestionRow } from "@/components/player-suggestion-row";
import { useRespondToConnection } from "@/hooks/usePlayers";
import type { PlayerSuggestion } from "@/types/player";

type ConnectionRequestsSheetProps = {
  requests: PlayerSuggestion[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Requests other players sent you, each with Accept or decline. */
export function ConnectionRequestsSheet({ requests, isOpen, onOpenChange }: ConnectionRequestsSheetProps) {
  const { toast } = useToast();
  const respond = useRespondToConnection();

  function answer(player: PlayerSuggestion, accept: boolean) {
    respond.mutate(
      { playerId: player.id, accept },
      {
        onSuccess: () => {
          if (accept) toast.show({ variant: "success", label: `You’re connected with ${player.firstName}` });
          // The last answer empties the list, so there's nothing left to review
          if (requests.length === 1) onOpenChange(false);
        },
        onError: (error) =>
          toast.show({ variant: "danger", label: "Couldn’t answer the request", description: error.message }),
      },
    );
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          contentContainerClassName="gap-4 px-5 pb-[34px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <BottomSheet.Title className="font-black text-[24px] tracking-[-0.4px] text-foreground">
                Connection requests
              </BottomSheet.Title>
              <BottomSheet.Description className="font-normal text-[14px] text-muted">
                Connect to see each other’s matches and play again.
              </BottomSheet.Description>
            </View>
            <BottomSheet.Close className="size-10 rounded-full bg-fill" />
          </View>

          <View className="gap-2.5">
            {requests.map((player) => (
              <PlayerSuggestionRow
                key={player.id}
                player={player}
                action={
                  <View className="flex-row items-center gap-1.5">
                    <Button
                      variant="ghost"
                      isIconOnly
                      hitSlop={5}
                      isDisabled={respond.isPending}
                      accessibilityLabel={`Decline ${player.firstName}’s request`}
                      onPress={() => answer(player, false)}
                      className="size-[34px] rounded-xl bg-fill"
                    >
                      <Icon as={X} size={16} color="muted" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      hitSlop={5}
                      isDisabled={respond.isPending}
                      accessibilityLabel={`Accept ${player.firstName}’s request`}
                      onPress={() => answer(player, true)}
                      className="h-[34px] rounded-xl px-3"
                    >
                      <Button.Label className="text-[13px]">Accept</Button.Label>
                    </Button>
                  </View>
                }
              />
            ))}
            {requests.length === 0 ? (
              <Text className="font-normal text-[14px] text-muted">No requests right now.</Text>
            ) : null}
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
