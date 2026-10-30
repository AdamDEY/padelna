import { BottomSheet, Button, useToast } from "heroui-native";
import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { toast } = useToast();
  const respond = useRespondToConnection();

  function answer(player: PlayerSuggestion, accept: boolean) {
    respond.mutate(
      { playerId: player.id, accept },
      {
        onSuccess: () => {
          if (accept) toast.show({ variant: "success", label: t("connections.connected", { name: player.firstName }) });
          // The last answer empties the list, so there's nothing left to review
          if (requests.length === 1) onOpenChange(false);
        },
        onError: (error) =>
          toast.show({ variant: "danger", label: t("connections.answerFailed"), description: error.message }),
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
                {t("connections.title")}
              </BottomSheet.Title>
              <BottomSheet.Description className="font-normal text-[14px] text-muted">
                {t("connections.description")}
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
                      accessibilityLabel={t("connections.declineA11y", { name: player.firstName })}
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
                      accessibilityLabel={t("connections.acceptA11y", { name: player.firstName })}
                      onPress={() => answer(player, true)}
                      className="h-[34px] rounded-xl px-3"
                    >
                      <Button.Label className="text-[13px]">{t("connections.accept")}</Button.Label>
                    </Button>
                  </View>
                }
              />
            ))}
            {requests.length === 0 ? (
              <Text className="font-normal text-[14px] text-muted">{t("connections.none")}</Text>
            ) : null}
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
